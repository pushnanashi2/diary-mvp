/**
 * Analytics Workflow E2E Test
 * 分析機能のワークフローテスト
 */

import request from 'supertest';
import app from '../../server.js';
import { getPool } from '../../config/database.js';

describe('Analytics Workflow E2E', () => {
  let pool;
  let authToken;
  let userId;
  let entryId;

  beforeAll(async () => {
    pool = getPool();

    // テストユーザー作成
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        email: `analytics-${Date.now()}@example.com`,
        password: 'password123'
      });

    authToken = registerResponse.body.access_token;
    userId = registerResponse.body.user_id;

    // テストエントリー作成
    const [result] = await pool.query(
      'INSERT INTO entries (user_id, public_id, title, audio_url, status, content_flagged) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'TEST-ENTRY-AN', 'Test Entry', 's3://test/audio.m4a', 'done', 0]
    );
    entryId = result.insertId;

    // 感情分析データ作成
    await pool.query(
      'INSERT INTO emotion_analysis (entry_id, primary_emotion, emotions, valence, arousal, dominance) VALUES (?, ?, ?, ?, ?, ?)',
      [entryId, 'happy', '{"happy": 0.8}', 0.7, 0.6, 0.5]
    );

    // タグ作成
    await pool.query(
      'INSERT INTO entry_tags (entry_id, tag) VALUES (?, ?)',
      [entryId, 'test-tag']
    );
  });

  afterAll(async () => {
    if (userId) {
      await pool.query('DELETE FROM emotion_analysis WHERE entry_id = ?', [entryId]);
      await pool.query('DELETE FROM entry_tags WHERE entry_id = ?', [entryId]);
      await pool.query('DELETE FROM entries WHERE user_id = ?', [userId]);
      await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    }
  });

  test('1. 感情推移グラフ取得', async () => {
    const response = await request(app)
      .get('/analytics/emotion-timeline')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ granularity: 'day' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('timeline');
    expect(Array.isArray(response.body.timeline)).toBe(true);
  });

  test('2. 総合分析サマリー取得', async () => {
    const response = await request(app)
      .get('/analytics/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ days: 30 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('total_entries');
    expect(response.body).toHaveProperty('avg_valence');
    expect(response.body).toHaveProperty('top_emotions');
    expect(response.body).toHaveProperty('top_tags');
  });

  test('3. 週単位の感情推移', async () => {
    const response = await request(app)
      .get('/analytics/emotion-timeline')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ granularity: 'week' });

    expect(response.status).toBe(200);
    expect(response.body.granularity).toBe('week');
  });

  test('4. 月単位の感情推移', async () => {
    const response = await request(app)
      .get('/analytics/emotion-timeline')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ granularity: 'month' });

    expect(response.status).toBe(200);
    expect(response.body.granularity).toBe('month');
  });
});
