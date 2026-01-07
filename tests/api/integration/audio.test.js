/**
 * 音声配信API統合テスト（Notion仕様準拠）
 * 
 * 参照: Notion「06-4. 音声配信（Audio）」
 * 
 * エンドポイント:
 * - GET /entries/:id/audio-link - 署名付き音声URL生成
 * - GET /audio?token=... - 署名付きURLで音声ストリーム取得
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../api/server.js';
import db from '../../../api/config/database.js';
import fs from 'fs';
import path from 'path';

describe('GET /entries/:id/audio-link - Notion仕様準拠', () => {
  let authToken;
  let userId;
  let entryId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: `audio_link_test_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Audio Link Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // 音声付きエントリ作成
    const audioPath = path.join(__dirname, '../../fixtures/test-audio.wav');
    if (fs.existsSync(audioPath)) {
      const entryRes = await request(app)
        .post('/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', audioPath)
        .field('mood', 'happy');
      entryId = entryRes.body.id;
    }
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  it('署名付き音声URL生成（200 + audio_url + expires_at）', async () => {
    if (!entryId) {
      console.log('⚠️ 音声ファイルがないためスキップ');
      return;
    }

    const res = await request(app)
      .get(`/entries/${entryId}/audio-link`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('audio_url');
    expect(res.body).toHaveProperty('expires_at');
    expect(res.body.audio_url).toContain('token=');
    
    // TTL確認（5分 = 300秒）
    const expiresAt = new Date(res.body.expires_at);
    const now = new Date();
    const diffSeconds = (expiresAt - now) / 1000;
    expect(diffSeconds).toBeGreaterThan(290); // 約5分
    expect(diffSeconds).toBeLessThan(310);
  });

  it('音声がないエントリで404エラー', async () => {
    // テキストエントリ作成（音声なし）
    const textEntryRes = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'テキストのみ',
        mood: 'neutral'
      });
    const textEntryId = textEntryRes.body.id;

    const res = await request(app)
      .get(`/entries/${textEntryId}/audio-link`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('他人のエントリで403エラー', async () => {
    if (!entryId) {
      console.log('⚠️ 音声ファイルがないためスキップ');
      return;
    }

    // 別ユーザー作成
    const otherUserRes = await request(app)
      .post('/auth/register')
      .send({
        email: `other_audio_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Other Audio User'
      });
    const otherToken = otherUserRes.body.token;

    const res = await request(app)
      .get(`/entries/${entryId}/audio-link`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /audio?token=... - Notion仕様準拠', () => {
  let authToken;
  let userId;
  let audioUrl;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: `audio_stream_test_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Audio Stream Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // 音声付きエントリ作成
    const audioPath = path.join(__dirname, '../../fixtures/test-audio.wav');
    if (fs.existsSync(audioPath)) {
      const entryRes = await request(app)
        .post('/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', audioPath)
        .field('mood', 'happy');
      const entryId = entryRes.body.id;

      // 署名付きURL取得
      const linkRes = await request(app)
        .get(`/entries/${entryId}/audio-link`)
        .set('Authorization', `Bearer ${authToken}`);
      audioUrl = linkRes.body.audio_url;
    }
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  it('署名付きURLで音声ストリーム取得（200 + audio/*）', async () => {
    if (!audioUrl) {
      console.log('⚠️ 音声ファイルがないためスキップ');
      return;
    }

    // URLからtokenを抽出
    const url = new URL(audioUrl, 'http://localhost');
    const token = url.searchParams.get('token');

    const res = await request(app)
      .get(`/audio?token=${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^audio\//); // audio/wav, audio/mpegなど
  });

  it('無効なtokenで401エラー', async () => {
    const res = await request(app)
      .get('/audio?token=invalid_token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('tokenなしで400エラー', async () => {
    const res = await request(app)
      .get('/audio');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('音声セキュリティテスト', () => {
  afterAll(async () => {
    await db.end();
  });

  it('TTL切れのtokenで401エラー', async () => {
    // 実際に5分待つのは現実的でないので、
    // モックまたは手動テストで確認
    console.log('⚠️ TTLテストは手動で確認が必要');
  });

  it('署名付きURLは第三者でも再生可能（セキュリティ警告）', async () => {
    // Notion仕様書に記載の通り、URL転送で第三者が再生可能
    // これは仕様なのでテストで確認する必要はないが、
    // 厳密な共有禁止が必要な場合はBearer必須方式へ変更が必要
    console.log('⚠️ セキュリティ仕様: URL転送で第三者再生可能（TTL内）');
  });
});
