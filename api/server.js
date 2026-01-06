/**
 * 音声AI日記アプリ - メインAPIサーバー
 * リファクタリング後: SQL・設定・ミドルウェア・ユーティリティを分離
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Config
import { APP_CONFIG, JWT_SECRET } from './config/secrets.js';
import { createDatabasePool } from './config/database.js';
import { createRedisClient } from './config/redis.js';
import { createMinioClient, getS3Bucket } from './config/storage.js';

// Database
import { runMigrations } from './db/migrations.js';

// Queries
import * as userQueries from './queries/userQueries.js';
import * as entryQueries from './queries/entryQueries.js';
import * as summaryQueries from './queries/summaryQueries.js';
import { getNextDailyCounter } from './queries/dailyCounterQueries.js';

// Middleware
import { auth } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';

// Utils
import { guessContentTypeFromKey, parseAudioKeyFromUrl } from './utils/audioUtils.js';
import { getUtcDateParts } from './utils/dateUtils.js';
import { validateTemplateId } from './utils/validation.js';

const app = express();
app.use(express.json());

// 初期化
const pool = await createDatabasePool();
const redis = createRedisClient();
const minio = createMinioClient();
const s3Bucket = getS3Bucket();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: APP_CONFIG.maxAudioBytes, files: 1 },
});

// マイグレーション実行
await runMigrations(pool);

// ========== 認証 ==========

app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email/password required' });
  }

  const hash = await bcrypt.hash(password, 10);
  
  try {
    const userId = await userQueries.createUser(pool, email, hash);
    const token = jwt.sign({ sub: String(userId) }, JWT_SECRET);
    res.json({ access_token: token });
  } catch (err) {
    res.status(409).json({ error: 'email exists' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  
  const user = await userQueries.findUserByEmail(pool, email);
  if (!user) {
    return res.status(401).json({ error: 'bad credentials' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'bad credentials' });
  }

  const token = jwt.sign({ sub: String(user.id) }, JWT_SECRET);
  res.json({ access_token: token });
});

// ========== ユーザー設定 ==========

app.get('/me', auth, async (req, res) => {
  const user = await userQueries.getUserById(pool, req.userId);
  res.json(user || null);
});

app.put('/me/default-summary-template', auth, async (req, res) => {
  const templateId = validateTemplateId(req.body?.template_id) || 'default';
  await userQueries.updateDefaultTemplate(pool, req.userId, templateId);
  res.json({ ok: true, default_summary_template: templateId });
});

app.delete('/me', auth, async (req, res) => {
  // ユーザーの全音声ファイルを削除
  const audioUrls = await entryQueries.getAllAudioUrlsByUser(pool, req.userId);
  
  for (const row of audioUrls) {
    try {
      const key = parseAudioKeyFromUrl(row.audio_url, s3Bucket);
      await minio.removeObject(s3Bucket, key).catch(() => {});
    } catch (err) {
      // 続行
    }
  }
  
  await userQueries.deleteUser(pool, req.userId);
  res.json({ ok: true });
});

// ========== 音声リンク生成・配信 ==========

app.get('/entries/:id/audio-link', auth, async (req, res) => {
  const entryId = Number(req.params.id);
  const exists = await entryQueries.checkEntryExists(pool, entryId, req.userId);
  
  if (!exists) {
    return res.status(404).json({ error: 'not found' });
  }

  const token = jwt.sign(
    { sub: String(req.userId), entryId: String(entryId) },
    JWT_SECRET,
    { expiresIn: APP_CONFIG.audioLinkTtlSec }
  );

  const base = APP_CONFIG.publicBaseUrl.replace(/\/$/, '');
  res.json({
    url: `${base}/audio?token=${encodeURIComponent(token)}`,
    expires_in: APP_CONFIG.audioLinkTtlSec,
  });
});

app.get('/audio', async (req, res) => {
  const token = String(req.query.token || '');
  if (!token) {
    return res.status(400).send('token required');
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).send('bad token');
  }

  const userId = Number(payload.sub);
  const entryId = Number(payload.entryId);
  
  if (!userId || !entryId) {
    return res.status(400).send('bad token');
  }

  const audioUrl = await entryQueries.getEntryAudioUrl(pool, entryId, userId);
  if (!audioUrl) {
    return res.status(404).send('not found');
  }

  let key;
  try {
    key = parseAudioKeyFromUrl(audioUrl, s3Bucket);
  } catch (err) {
    return res.status(500).send('audio mapping error');
  }

  res.setHeader('Content-Type', guessContentTypeFromKey(key));
  
  try {
    const stream = await minio.getObject(s3Bucket, key);
    stream.on('error', () => res.status(500).end());
    stream.pipe(res);
  } catch (err) {
    return res.status(500).send('storage error');
  }
});

// ========== エントリ ==========

app.post('/entries', auth, upload.single('audio'), async (req, res) => {
  // レート制限チェック
  if (!(await rateLimit(redis, req.userId, 'entries', APP_CONFIG.rateLimitEntriesPerMin))) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'audio required' });
  }

  // タイトル生成
  const now = new Date();
  const { dateYmd, HH, MM } = getUtcDateParts(now);
  const counter = await getNextDailyCounter(pool, req.userId, dateYmd);
  const title = `${dateYmd}-${HH}-${MM}-#${counter}`;

  // MinIOにアップロード
  const objectKey = `${req.userId}/${now.toISOString().replace(/[:.]/g, '')}_${uuidv4()}_${req.file.originalname}`;
  
  await minio.putObject(s3Bucket, objectKey, req.file.buffer, {
    'Content-Type': req.file.mimetype || 'application/octet-stream',
  });

  // NOTE: 内部的なURL（workerからアクセス可能）
  const audioUrl = `http://localhost:9000/${s3Bucket}/${objectKey}`;

  // エントリ作成
  const entryId = await entryQueries.createEntry(pool, req.userId, title, audioUrl);

  // Redisジョブ投入
  await redis.lpush('jobs:default', JSON.stringify({
    type: 'PROCESS_ENTRY',
    entryId,
  }));

  res.json({ id: entryId, title });
});

app.get('/entries', auth, async (req, res) => {
  const entries = await entryQueries.listEntries(pool, req.userId, 50);
  res.json(entries);
});

app.get('/entries/:id', auth, async (req, res) => {
  const entryId = Number(req.params.id);
  const entry = await entryQueries.getEntryById(pool, entryId, req.userId);
  
  if (!entry) {
    return res.status(404).json({ error: 'not found' });
  }
  
  res.json(entry);
});

app.delete('/entries/:id', auth, async (req, res) => {
  const entryId = Number(req.params.id);
  const audioUrl = await entryQueries.getEntryAudioUrl(pool, entryId, req.userId);
  
  if (!audioUrl) {
    return res.status(404).json({ error: 'not found' });
  }

  // MinIOから削除
  try {
    const key = parseAudioKeyFromUrl(audioUrl, s3Bucket);
    await minio.removeObject(s3Bucket, key).catch(() => {});
  } catch (err) {
    // 続行
  }

  await entryQueries.deleteEntry(pool, entryId, req.userId);
  res.json({ ok: true });
});

// ========== 期間要約 ==========

app.post('/summaries', auth, async (req, res) => {
  // レート制限チェック
  if (!(await rateLimit(redis, req.userId, 'summaries', APP_CONFIG.rateLimitSummariesPerMin))) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const { range_start, range_end, template_id } = req.body || {};
  
  if (!range_start || !range_end) {
    return res.status(400).json({ error: 'range_start/range_end required' });
  }

  // テンプレートID決定
  let templateId = validateTemplateId(template_id);
  if (!templateId) {
    templateId = await userQueries.getDefaultTemplate(pool, req.userId);
  }

  // 要約作成
  const summaryId = await summaryQueries.createSummary(
    pool,
    req.userId,
    range_start,
    range_end,
    templateId
  );

  // Redisジョブ投入
  await redis.lpush('jobs:default', JSON.stringify({
    type: 'PROCESS_RANGE_SUMMARY',
    summaryId,
  }));

  res.json({ id: summaryId });
});

app.get('/summaries', auth, async (req, res) => {
  const status = (req.query.status || '').toString().trim();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  const summaries = await summaryQueries.listSummaries(
    pool,
    req.userId,
    status,
    limit,
    offset
  );

  res.json(summaries);
});

app.get('/summaries/:id', auth, async (req, res) => {
  const summaryId = Number(req.params.id);
  const summary = await summaryQueries.getSummaryById(pool, summaryId, req.userId);
  
  if (!summary) {
    return res.status(404).json({ error: 'not found' });
  }
  
  res.json(summary);
});

app.post('/summaries/:id/retry', auth, async (req, res) => {
  const summaryId = Number(req.params.id);
  
  if (!Number.isFinite(summaryId)) {
    return res.status(400).json({ error: 'bad id' });
  }

  const exists = await summaryQueries.checkSummaryExists(pool, summaryId, req.userId);
  if (!exists) {
    return res.status(404).json({ error: 'not found' });
  }

  // ステータスをqueuedにリセット
  await summaryQueries.resetSummaryToQueued(pool, summaryId, req.userId);

  // Redisジョブ投入
  await redis.lpush('jobs:default', JSON.stringify({
    type: 'PROCESS_RANGE_SUMMARY',
    summaryId,
  }));

  res.json({ id: summaryId, status: 'queued' });
});

// ========== ヘルスチェック ==========

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ========== サーバー起動 ==========

app.listen(APP_CONFIG.port, '0.0.0.0', () => {
  console.log(`✅ API server listening on :${APP_CONFIG.port}`);
  console.log(`📁 Storage bucket: ${s3Bucket}`);
});
