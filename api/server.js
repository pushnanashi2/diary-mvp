import express from "express";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { Client as Minio } from "minio";
import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";
import path from "path";

const app = express();
app.use(express.json());

const {
  PORT = 8000,
  MYSQL_HOST, MYSQL_PORT, MYSQL_DB, MYSQL_USER, MYSQL_PASSWORD,
  REDIS_URL,
  JWT_SECRET,
  PUBLIC_BASE_URL = "http://localhost:8000",
  S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET,
  MAX_AUDIO_BYTES = "26214400",
  AUDIO_LINK_TTL_SEC = "600",
  RL_ENTRIES_PER_MIN = "30",
  RL_SUMMARIES_PER_MIN = "20",
} = process.env;

const maxAudioBytes = Number(MAX_AUDIO_BYTES);
const audioLinkTtlSec = Number(AUDIO_LINK_TTL_SEC);

const redis = new Redis(REDIS_URL);

const pool = await mysql.createPool({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT || 3306),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DB,
  connectionLimit: 10,
});

function makeMinioClient(endpointUrl) {
  const [h, p] = endpointUrl.replace("http://", "").replace("https://", "").split(":");
  return new Minio({
    endPoint: h,
    port: Number(p || 9000),
    useSSL: endpointUrl.startsWith("https://"),
    accessKey: S3_ACCESS_KEY,
    secretKey: S3_SECRET_KEY,
  });
}
const minio = makeMinioClient(S3_ENDPOINT);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxAudioBytes, files: 1 },
});

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.toLowerCase().startsWith("bearer ")) return res.status(401).json({ error: "unauthorized" });
  try {
    const token = h.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = Number(payload.sub);
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

async function rateLimit(userId, key, limitPerMin) {
  const bucket = Math.floor(Date.now() / 60000);
  const k = `rl:${userId}:${key}:${bucket}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, 60);
  return n <= limitPerMin;
}

async function addColumnIfMissing(table, column, alterSql) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema=? AND table_name=? AND column_name=?`,
    [MYSQL_DB, table, column]
  );
  if (Number(rows[0]?.cnt || 0) === 0) {
    await pool.query(alterSql);
  }
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
  await addColumnIfMissing(
    "users",
    "default_summary_template",
    "ALTER TABLE users ADD COLUMN default_summary_template VARCHAR(32) NOT NULL DEFAULT 'default'"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      title VARCHAR(64) NOT NULL,
      audio_url TEXT NOT NULL,
      transcript_text MEDIUMTEXT NULL,
      summary_text MEDIUMTEXT NULL,
      UNIQUE KEY uq_user_title (user_id, title),
      INDEX idx_user_created (user_id, created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);
  await addColumnIfMissing("entries", "pii_detected", "ALTER TABLE entries ADD COLUMN pii_detected TINYINT NOT NULL DEFAULT 0");
  await addColumnIfMissing("entries", "pii_types", "ALTER TABLE entries ADD COLUMN pii_types TEXT NULL");
  await addColumnIfMissing("entries", "pii_acknowledged", "ALTER TABLE entries ADD COLUMN pii_acknowledged TINYINT NOT NULL DEFAULT 0");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_counters (
      user_id BIGINT NOT NULL,
      date_ymd CHAR(10) NOT NULL,
      counter INT NOT NULL,
      PRIMARY KEY (user_id, date_ymd),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS summaries (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      range_start DATETIME NOT NULL,
      range_end DATETIME NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'queued',
      summary_text MEDIUMTEXT NULL,
      error_code VARCHAR(64) NULL,
      error_message VARCHAR(255) NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_range (user_id, range_start, range_end),
      INDEX idx_user_status (user_id, status, created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await addColumnIfMissing("summaries", "template_id",
    "ALTER TABLE summaries ADD COLUMN template_id VARCHAR(32) NOT NULL DEFAULT 'default'");
  await addColumnIfMissing("summaries", "status",
    "ALTER TABLE summaries ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'queued'");
  await addColumnIfMissing("summaries", "error_code",
    "ALTER TABLE summaries ADD COLUMN error_code VARCHAR(64) NULL");
  await addColumnIfMissing("summaries", "error_message",
    "ALTER TABLE summaries ADD COLUMN error_message VARCHAR(255) NULL");
  await addColumnIfMissing("summaries", "started_at",
    "ALTER TABLE summaries ADD COLUMN started_at DATETIME NULL");
  await addColumnIfMissing("summaries", "finished_at",
    "ALTER TABLE summaries ADD COLUMN finished_at DATETIME NULL");

  const exists = await minio.bucketExists(S3_BUCKET).catch(() => false);
  if (!exists) await minio.makeBucket(S3_BUCKET);
}

function utcParts(now) {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const HH = String(now.getUTCHours()).padStart(2, "0");
  const MM = String(now.getUTCMinutes()).padStart(2, "0");
  return { yyyy, mm, dd, HH, MM, dateYmd: `${yyyy}-${mm}-${dd}` };
}

async function nextDailyCounter(userId, dateYmd) {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `INSERT INTO daily_counters(user_id, date_ymd, counter)
       VALUES (?,?,1)
       ON DUPLICATE KEY UPDATE counter = LAST_INSERT_ID(counter + 1)`,
      [userId, dateYmd]
    );
    const [[row]] = await conn.query(`SELECT LAST_INSERT_ID() AS n`);
    return Number(row.n);
  } finally {
    conn.release();
  }
}

function guessContentTypeFromKey(key) {
  const ext = path.extname(key).toLowerCase();
  if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg" || ext === ".opus") return "audio/ogg";
  if (ext === ".webm") return "audio/webm";
  return "application/octet-stream";
}

function parseAudioKeyFromUrl(audioUrl) {
  const marker = `/${S3_BUCKET}/`;
  const idx = audioUrl.indexOf(marker);
  if (idx === -1) throw new Error("bad audio_url");
  return audioUrl.slice(idx + marker.length);
}

function validateTemplateId(x) {
  const t = (x || "").toString().trim();
  if (!t) return "";
  if (!/^[a-z0-9_-]{1,32}$/i.test(t)) return "";
  return t;
}

// -------- auth --------
app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email/password required" });

  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await pool.query(`INSERT INTO users(email, password_hash) VALUES (?,?)`, [email, hash]);
    const token = jwt.sign({ sub: String(r.insertId) }, JWT_SECRET);
    res.json({ access_token: token });
  } catch {
    res.status(409).json({ error: "email exists" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const [rows] = await pool.query(`SELECT id, password_hash FROM users WHERE email=?`, [email]);
  const u = rows[0];
  if (!u) return res.status(401).json({ error: "bad credentials" });
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return res.status(401).json({ error: "bad credentials" });
  const token = jwt.sign({ sub: String(u.id) }, JWT_SECRET);
  res.json({ access_token: token });
});

// -------- me (default template) --------
app.get("/me", auth, async (req, res) => {
  const [rows] = await pool.query(`SELECT id, email, default_summary_template FROM users WHERE id=?`, [req.userId]);
  res.json(rows[0] || null);
});

app.put("/me/default-summary-template", auth, async (req, res) => {
  const template_id = validateTemplateId(req.body?.template_id) || "default";
  await pool.query(`UPDATE users SET default_summary_template=? WHERE id=?`, [template_id, req.userId]);
  res.json({ ok: true, default_summary_template: template_id });
});

// -------- audio link + proxy --------
app.get("/entries/:id/audio-link", auth, async (req, res) => {
  const entryId = Number(req.params.id);
  const [rows] = await pool.query(`SELECT id FROM entries WHERE id=? AND user_id=?`, [entryId, req.userId]);
  if (!rows[0]) return res.status(404).json({ error: "not found" });

  const token = jwt.sign(
    { sub: String(req.userId), entryId: String(entryId) },
    JWT_SECRET,
    { expiresIn: audioLinkTtlSec }
  );

  const base = PUBLIC_BASE_URL.replace(/\/$/, "");
  res.json({ url: `${base}/audio?token=${encodeURIComponent(token)}`, expires_in: audioLinkTtlSec });
});

app.get("/audio", async (req, res) => {
  const token = String(req.query.token || "");
  if (!token) return res.status(400).send("token required");

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).send("bad token");
  }

  const userId = Number(payload.sub);
  const entryId = Number(payload.entryId);
  if (!userId || !entryId) return res.status(400).send("bad token");

  const [rows] = await pool.query(`SELECT audio_url FROM entries WHERE id=? AND user_id=?`, [entryId, userId]);
  if (!rows[0]) return res.status(404).send("not found");

  let key;
  try {
    key = parseAudioKeyFromUrl(rows[0].audio_url);
  } catch {
    return res.status(500).send("audio mapping error");
  }

  res.setHeader("Content-Type", guessContentTypeFromKey(key));
  try {
    const stream = await minio.getObject(S3_BUCKET, key);
    stream.on("error", () => res.status(500).end());
    stream.pipe(res);
  } catch {
    return res.status(500).send("storage error");
  }
});

// -------- entries --------
app.post("/entries", auth, upload.single("audio"), async (req, res) => {
  if (!(await rateLimit(req.userId, "entries", Number(RL_ENTRIES_PER_MIN)))) {
    return res.status(429).json({ error: "rate_limited" });
  }
  if (!req.file) return res.status(400).json({ error: "audio required" });

  const now = new Date();
  const { dateYmd, HH, MM } = utcParts(now);
  const n = await nextDailyCounter(req.userId, dateYmd);
  const title = `${dateYmd}-${HH}-${MM}-#${n}`;

  const objectKey = `${req.userId}/${now.toISOString().replace(/[:.]/g, "")}_${uuidv4()}_${req.file.originalname}`;
  await minio.putObject(S3_BUCKET, objectKey, req.file.buffer, {
    "Content-Type": req.file.mimetype || "application/octet-stream",
  });

  // 内部参照用（APIが /audio で代理配信するので、外に出す必要は基本ない）
  const audioUrl = `http://localhost:9000/${S3_BUCKET}/${objectKey}`;

  const [r] = await pool.query(
    `INSERT INTO entries(user_id, title, audio_url) VALUES (?,?,?)`,
    [req.userId, title, audioUrl]
  );

  await redis.lpush("jobs:default", JSON.stringify({ type: "PROCESS_ENTRY", entryId: r.insertId }));
  res.json({ id: r.insertId, title });
});

app.get("/entries", auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, title, created_at, summary_text, pii_detected, pii_types, pii_acknowledged, content_flagged, flag_types
     FROM entries WHERE user_id=? ORDER BY created_at DESC LIMIT 50`,
    [req.userId]
  );
  res.json(rows);
});

app.get("/entries/:id", auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, title, created_at, audio_url, transcript_text, summary_text, pii_detected, pii_types, pii_acknowledged, content_flagged, flag_types
     FROM entries WHERE id=? AND user_id=?`,
    [req.params.id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

app.delete("/entries/:id", auth, async (req, res) => {
  const entryId = Number(req.params.id);
  const [rows] = await pool.query(`SELECT audio_url FROM entries WHERE id=? AND user_id=?`, [entryId, req.userId]);
  if (!rows[0]) return res.status(404).json({ error: "not found" });

  try {
    const key = parseAudioKeyFromUrl(rows[0].audio_url);
    await minio.removeObject(S3_BUCKET, key).catch(() => {});
  } catch {}

  await pool.query(`DELETE FROM entries WHERE id=? AND user_id=?`, [entryId, req.userId]);
  res.json({ ok: true });
});

app.delete("/me", auth, async (req, res) => {
  const [rows] = await pool.query(`SELECT audio_url FROM entries WHERE user_id=?`, [req.userId]);
  for (const r0 of rows) {
    try {
      const key = parseAudioKeyFromUrl(r0.audio_url);
      await minio.removeObject(S3_BUCKET, key).catch(() => {});
    } catch {}
  }
  await pool.query(`DELETE FROM users WHERE id=?`, [req.userId]);
  res.json({ ok: true });
});

// -------- summaries --------
app.post("/summaries", auth, async (req, res) => {
  if (!(await rateLimit(req.userId, "summaries", Number(RL_SUMMARIES_PER_MIN)))) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const { range_start, range_end, template_id } = req.body || {};
  if (!range_start || !range_end) return res.status(400).json({ error: "range_start/range_end required" });

  let tpl = validateTemplateId(template_id);
  if (!tpl) {
    const [urows] = await pool.query(`SELECT default_summary_template FROM users WHERE id=?`, [req.userId]);
    tpl = (urows[0]?.default_summary_template || "default");
  }

  const [r] = await pool.query(
    `INSERT INTO summaries(user_id, range_start, range_end, status, template_id)
     VALUES (?,?,?, 'queued', ?)`,
    [req.userId, new Date(range_start), new Date(range_end), tpl]
  );

  await redis.lpush("jobs:default", JSON.stringify({ type: "PROCESS_RANGE_SUMMARY", summaryId: r.insertId }));
  res.json({ id: r.insertId });
});

app.get("/summaries", auth, async (req, res) => {
  const status = (req.query.status || "").toString().trim();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  let sql =
    `SELECT id, range_start, range_end, status, template_id, error_code, started_at, finished_at, created_at
     FROM summaries WHERE user_id=?`;
  const params = [req.userId];

  if (status) {
    sql += ` AND status=?`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

app.get("/summaries/:id", auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, range_start, range_end, status, template_id, summary_text, error_code, error_message, started_at, finished_at, created_at
     FROM summaries WHERE id=? AND user_id=?`,
    [req.params.id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

app.post("/summaries/:id/retry", auth, async (req, res) => {
  const summaryId = Number(req.params.id);
  if (!Number.isFinite(summaryId)) return res.status(400).json({ error: "bad id" });

  const [rows] = await pool.query(`SELECT id FROM summaries WHERE id=? AND user_id=?`, [summaryId, req.userId]);
  if (!rows[0]) return res.status(404).json({ error: "not found" });

  await pool.query(
    `UPDATE summaries
     SET status='queued', error_code=NULL, error_message=NULL, started_at=NULL, finished_at=NULL, summary_text=NULL
     WHERE id=? AND user_id=?`,
    [summaryId, req.userId]
  );

  await redis.lpush("jobs:default", JSON.stringify({ type: "PROCESS_RANGE_SUMMARY", summaryId }));
  res.json({ id: summaryId, status: "queued" });
});

await migrate();
app.listen(PORT, "0.0.0.0", () => console.log(`API listening on :${PORT}`));
