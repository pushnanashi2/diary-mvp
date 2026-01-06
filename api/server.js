/**
 * 音声AI日記アプリ - メインAPIサーバー（Phase1対応版）
 * 
 * Phase1対応内容:
 * 1. public_id化（ULID採用）
 * 2. 音声URL転送禁止（Bearer必須化）
 * 3. CORS設定
 * 4. ファイル検証強化
 */

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { ulid } from 'ulid';
import { v4 as uuidv4 } from 'uuid';

// Config
import { APP_CONFIG, JWT_SECRET } from './config/secrets.js';
import { createDatabasePool } from './config/database.js';
import { createRedisClient } from './config/redis.js';
import { createMinioClient, getS3Bucket } from './config/storage.js';

// Queries
import { createUser, getUserByEmail, getUserById, updateUserDefaultTemplate, deleteUser } from './queries/userQueries.js';
import {
  createEntry,
  listEntries,
  getEntryByPublicId,
  getEntryAudioUrl,
  deleteEntry,
  getAllAudioUrlsByUser,
  checkEntryExists
} from './queries/entryQueries.js';
import {
  createSummary,
  listSummaries,
  getSummaryByPublicId,
  resetSummaryToQueued,
  checkSummaryExists
} from './queries/summaryQueries.js';
import { incrementDailyCounter } from './queries/dailyCounterQueries.js';

// Middleware & Utils
import { authenticateToken } from './middleware/auth.js';
import { guessContentTypeFromKey } from './utils/audioUtils.js';
import { getUtcDateParts } from './utils/dateUtils.js';
import { validateAudioFile, audioFileFilter } from './utils/fileValidation.js';

// Migrations
import { runMigrations } from './db/migrations.js';

const app = express();

// ========================================
// Phase1-3: CORS設定
// ========================================
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // 本番では具体的なoriginを指定
  credentials: true
}));

app.use(express.json());

// ========================================
// 初期化
// ========================================
const pool = await createDatabasePool();
const redis = await createRedisClient();
const minioClient = await createMinioClient();
const s3Bucket = getS3Bucket();

// マイグレーション実行
await runMigrations(pool);

console.log(`[server] Using MinIO bucket: ${s3Bucket}`);

// ========================================
// Phase1-4: ファイルアップロード設定（検証強化）
// ========================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: APP_CONFIG.maxAudioBytes },
  fileFilter: audioFileFilter
});

// ========================================
// 認証ミドルウェアのエイリアス
// ========================================
const auth = authenticateToken;

// ========================================
// レート制限関数
// ========================================
async function rateLimit(endpoint, userId, limitPerWindow = 30, windowSec = 60) {
  const key = `rate_limit:${userId}:${endpoint}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  if (count > limitPerWindow) {
    return false;
  }
  return true;
}

// ========================================
// テンプレートID検証
// ========================================
function validateTemplateId(tid) {
  const valid = ['default', 'bullet', 'emotion'];
  return valid.includes(tid) ? tid : null;
}

// ========================================
// API: 認証
// ========================================

// ユーザー登録
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const existing = await getUserByEmail(pool, email);
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await createUser(pool, email, hashedPassword);

    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ access_token: token });
  } catch (error) {
    console.error('[POST /auth/register] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ログイン
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const user = await getUserByEmail(pool, email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ access_token: token });
  } catch (error) {
    console.error('[POST /auth/login] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// API: ユーザー設定
// ========================================

// ユーザー情報取得
app.get('/me', auth, async (req, res) => {
  try {
    const user = await getUserById(pool, req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, email: user.email, default_summary_template: user.default_summary_template });
  } catch (error) {
    console.error('[GET /me] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// デフォルトテンプレート変更
app.put('/me/default-summary-template', auth, async (req, res) => {
  try {
    const templateId = validateTemplateId(req.body?.template_id) || 'default';
    await updateUserDefaultTemplate(pool, req.userId, templateId);
    res.json({ ok: true, default_summary_template: templateId });
  } catch (error) {
    console.error('[PUT /me/default-summary-template] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ユーザー削除（全データ削除）
app.delete('/me', auth, async (req, res) => {
  try {
    const audioUrls = await getAllAudioUrlsByUser(pool, req.userId);
    for (const row of audioUrls) {
      const audioUrl = row.audio_url;
      if (audioUrl && audioUrl.includes(s3Bucket)) {
        const key = audioUrl.split(`/${s3Bucket}/`)[1];
        if (key) {
          try {
            await minioClient.removeObject(s3Bucket, key);
          } catch (err) {
            console.error(`[DELETE /me] Failed to delete audio: ${key}`, err);
          }
        }
      }
    }

    await deleteUser(pool, req.userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /me] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// API: エントリ（Phase1-1: public_id化、Phase1-2: Bearer必須化）
// ========================================

// Phase1-2: 音声ストリーム配信（Bearer必須）
app.get('/entries/:public_id/audio', auth, async (req, res) => {
  try {
    const { public_id } = req.params;
    
    const audioUrl = await getEntryAudioUrl(pool, public_id, req.userId);
    if (!audioUrl) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (!audioUrl.includes(s3Bucket)) {
      return res.status(500).json({ error: 'Invalid audio URL' });
    }

    const key = audioUrl.split(`/${s3Bucket}/`)[1];
    if (!key) {
      return res.status(500).json({ error: 'Invalid audio key' });
    }

    const contentType = guessContentTypeFromKey(key);
    res.set('Content-Type', contentType);

    const stream = await minioClient.getObject(s3Bucket, key);
    stream.pipe(res);
  } catch (error) {
    console.error('[GET /entries/:public_id/audio] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// エントリ作成（Phase1-1: public_id、Phase1-4: ファイル検証強化）
app.post('/entries', auth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    // Phase1-4: マジックバイト検証
    const validation = await validateAudioFile(req.file.buffer, req.file.originalname);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // レート制限
    const allowed = await rateLimit('entries', req.userId, APP_CONFIG.rlEntriesPerMin, 60);
    if (!allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // タイトル生成
    const now = new Date();
    const { dateYmd, HH, MM } = getUtcDateParts(now);
    const counter = await incrementDailyCounter(pool, req.userId, dateYmd);
    const title = `${dateYmd}-${HH}-${MM}-#${counter}`;

    // MinIOアップロード
    const nowISO = now.toISOString().replace(/[:.]/g, '-');
    const objectKey = `${req.userId}/${nowISO}_${uuidv4()}_${req.file.originalname}`;
    await minioClient.putObject(s3Bucket, objectKey, req.file.buffer);

    const audioUrl = `http://localhost:9000/${s3Bucket}/${objectKey}`;

    // Phase1-1: public_id生成
    const publicId = ulid();
    
    // DB登録
    const entryId = await createEntry(pool, req.userId, publicId, title, audioUrl);

    // Redisジョブ投入
    await redis.lpush('jobs:default', JSON.stringify({ type: 'PROCESS_ENTRY', entryId }));

    res.json({ id: entryId, public_id: publicId, title });
  } catch (error) {
    console.error('[POST /entries] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// エントリ一覧取得
app.get('/entries', auth, async (req, res) => {
  try {
    const entries = await listEntries(pool, req.userId, 50);
    res.json(entries);
  } catch (error) {
    console.error('[GET /entries] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// エントリ詳細取得（Phase1-1: public_idで取得）
app.get('/entries/:public_id', auth, async (req, res) => {
  try {
    const entry = await getEntryByPublicId(pool, req.params.public_id, req.userId);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(entry);
  } catch (error) {
    console.error('[GET /entries/:public_id] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// エントリ削除（Phase1-1: public_idで削除）
app.delete('/entries/:public_id', auth, async (req, res) => {
  try {
    const audioUrl = await getEntryAudioUrl(pool, req.params.public_id, req.userId);
    if (!audioUrl) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // MinIO削除
    if (audioUrl.includes(s3Bucket)) {
      const key = audioUrl.split(`/${s3Bucket}/`)[1];
      if (key) {
        try {
          await minioClient.removeObject(s3Bucket, key);
        } catch (err) {
          console.error(`[DELETE /entries/:public_id] Failed to delete audio: ${key}`, err);
        }
      }
    }

    await deleteEntry(pool, req.params.public_id, req.userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /entries/:public_id] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// API: 期間要約（Phase1-1: public_id化）
// ========================================

// 期間要約作成
app.post('/summaries', auth, async (req, res) => {
  try {
    const { range_start, range_end, template_id } = req.body;

    if (!range_start || !range_end) {
      return res.status(400).json({ error: 'range_start and range_end required' });
    }

    // レート制限
    const allowed = await rateLimit('summaries', req.userId, APP_CONFIG.rlSummariesPerMin, 60);
    if (!allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const user = await getUserById(pool, req.userId);
    const templateId = validateTemplateId(template_id) || user?.default_summary_template || 'default';

    // Phase1-1: public_id生成
    const publicId = ulid();

    const summaryId = await createSummary(pool, req.userId, publicId, range_start, range_end, templateId);

    await redis.lpush('jobs:default', JSON.stringify({ type: 'PROCESS_RANGE_SUMMARY', summaryId }));

    res.json({ id: summaryId, public_id: publicId });
  } catch (error) {
    console.error('[POST /summaries] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 期間要約一覧取得
app.get('/summaries', auth, async (req, res) => {
  try {
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const summaries = await listSummaries(pool, req.userId, status, limit, offset);
    res.json(summaries);
  } catch (error) {
    console.error('[GET /summaries] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 期間要約詳細取得（Phase1-1: public_idで取得）
app.get('/summaries/:public_id', auth, async (req, res) => {
  try {
    const summary = await getSummaryByPublicId(pool, req.params.public_id, req.userId);
    if (!summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }
    res.json(summary);
  } catch (error) {
    console.error('[GET /summaries/:public_id] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 期間要約リトライ（Phase1-1: public_idで検索）
app.post('/summaries/:public_id/retry', auth, async (req, res) => {
  try {
    const exists = await checkSummaryExists(pool, req.params.public_id, req.userId);
    if (!exists) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    await resetSummaryToQueued(pool, req.params.public_id, req.userId);

    const summary = await getSummaryByPublicId(pool, req.params.public_id, req.userId);
    await redis.lpush('jobs:default', JSON.stringify({ type: 'PROCESS_RANGE_SUMMARY', summaryId: summary.id }));

    res.json({ public_id: req.params.public_id, status: 'queued' });
  } catch (error) {
    console.error('[POST /summaries/:public_id/retry] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// ヘルスチェック
// ========================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ========================================
// サーバー起動
// ========================================
const PORT = APP_CONFIG.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] API listening on port ${PORT}`);
  console.log(`[server] MinIO bucket: ${s3Bucket}`);
  console.log(`[server] Phase1対応完了: public_id化 / Bearer必須 / CORS / ファイル検証強化`);
});
