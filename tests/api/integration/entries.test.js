/**
 * エントリAPI統合テスト（Notion仕様準拠）
 * 
 * 参照: Notion「06-3. エントリ（Entries）」
 * 
 * エンドポイント:
 * - POST /entries - 音声アップロード＆エントリ作成
 * - GET /entries - エントリ一覧取得
 * - GET /entries/:id - エントリ詳細取得
 * - DELETE /entries/:id - エントリ削除
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../api/server.js';
import db from '../../../api/config/database.js';
import fs from 'fs';
import path from 'path';

describe('POST /entries - Notion仕様準拠', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: `entries_test_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Entries Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  it('音声ファイルアップロードでエントリ作成（201）', async () => {
    const audioPath = path.join(__dirname, '../../fixtures/test-audio.wav');
    
    // テスト用音声ファイルがない場合はスキップ
    if (!fs.existsSync(audioPath)) {
      console.log('⚠️ テスト用音声ファイルがないためスキップ');
      return;
    }

    const res = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('audio', audioPath)
      .field('mood', 'happy');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('title'); // YYYY-MM-DD-HH-MM-#N形式
    expect(res.body).toHaveProperty('audio_url');
    expect(res.body).toHaveProperty('created_at');
    expect(res.body.user_id).toBe(userId);
    
    // worker処理は非同期なのでtranscript/summaryはnull
    expect(res.body.transcript).toBeNull();
    expect(res.body.summary).toBeNull();
  });

  it('テキストエントリ作成（201）', async () => {
    const res = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: '今日はとても良い日でした。',
        mood: 'happy'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.content).toBe('今日はとても良い日でした。');
    expect(res.body.mood).toBe('happy');
  });

  it('必須フィールドなしで400エラー', async () => {
    const res = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('認証なしで401エラー', async () => {
    const res = await request(app)
      .post('/entries')
      .send({
        content: 'テスト',
        mood: 'neutral'
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /entries - Notion仕様準拠', () => {
  let authToken;
  let userId;
  let entryIds = [];

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: `list_test_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'List Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // テスト用エントリ作成
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: `テストエントリ ${i + 1}`,
          mood: 'neutral'
        });
      entryIds.push(res.body.id);
    }
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  it('エントリ一覧取得（200）', async () => {
    const res = await request(app)
      .get('/entries')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    
    // レスポンス構造確認
    const entry = res.body[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('title');
    expect(entry).toHaveProperty('content');
    expect(entry).toHaveProperty('mood');
    expect(entry).toHaveProperty('created_at');
  });

  it('認証なしで401エラー', async () => {
    const res = await request(app)
      .get('/entries');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /entries/:id - Notion仕様準拠', () => {
  let authToken;
  let userId;
  let entryId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: `detail_test_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Detail Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // テスト用エントリ作成
    const entryRes = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'テスト詳細',
        mood: 'happy'
      });
    entryId = entryRes.body.id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  it('エントリ詳細取得（200）', async () => {
    const res = await request(app)
      .get(`/entries/${entryId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(entryId);
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('content');
    expect(res.body).toHaveProperty('mood');
    expect(res.body).toHaveProperty('created_at');
  });

  it('存在しないIDで404エラー', async () => {
    const res = await request(app)
      .get('/entries/99999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('他人のエントリにアクセスで403エラー', async () => {
    // 別ユーザー作成
    const otherUserRes = await request(app)
      .post('/auth/register')
      .send({
        email: `other_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Other User'
      });
    const otherToken = otherUserRes.body.token;

    const res = await request(app)
      .get(`/entries/${entryId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('DELETE /entries/:id - Notion仕様準拠', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: `delete_test_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Delete Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  it('エントリ削除（204）', async () => {
    // エントリ作成
    const entryRes = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: '削除テスト',
        mood: 'neutral'
      });
    const entryId = entryRes.body.id;

    // 削除実行
    const res = await request(app)
      .delete(`/entries/${entryId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(204);

    // 削除確認
    const getRes = await request(app)
      .get(`/entries/${entryId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(getRes.status).toBe(404);
  });

  it('存在しないIDで404エラー', async () => {
    const res = await request(app)
      .delete('/entries/99999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
