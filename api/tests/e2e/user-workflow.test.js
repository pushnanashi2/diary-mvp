/**
 * User Workflow E2E Tests
 * ユーザーワークフローのE2Eテスト
 */

import request from 'supertest';
import app from '../../server.js';
import { getPool } from '../../config/database.js';

describe('User Workflow E2E', () => {
  let pool;
  const testUser = {
    email: `e2e-${Date.now()}@example.com`,
    password: 'password123'
  };
  let authToken;
  let userId;
  let entryPublicId;

  beforeAll(() => {
    pool = getPool();
  });

  afterAll(async () => {
    // クリーンアップ
    if (userId) {
      await pool.query('DELETE FROM entries WHERE user_id = ?', [userId]);
      await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    }
  });

  test('1. ユーザー登録', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send(testUser);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('access_token');
    
    authToken = response.body.access_token;
    userId = response.body.user_id;
  });

  test('2. ログイン', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send(testUser);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('access_token');
  });

  test('3. エントリー一覧取得（空）', async () => {
    const response = await request(app)
      .get('/entries')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(0);
  });

  test('4. エントリー作成', async () => {
    // モックエントリー作成（実際のファイルアップロードなし）
    const [result] = await pool.query(
      'INSERT INTO entries (user_id, public_id, title, audio_url, status) VALUES (?, ?, ?, ?, ?)',
      [userId, 'TEST-ENTRY-001', 'Test Entry', 's3://test/audio.m4a', 'processing']
    );

    entryPublicId = 'TEST-ENTRY-001';
    expect(result.affectedRows).toBe(1);
  });

  test('5. エントリー一覧取得（1件）', async () => {
    const response = await request(app)
      .get('/entries')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.entries.length).toBeGreaterThan(0);
  });

  test('6. 特定エントリー取得', async () => {
    const response = await request(app)
      .get(`/entries/${entryPublicId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.public_id).toBe(entryPublicId);
  });

  test('7. エントリー削除', async () => {
    const response = await request(app)
      .delete(`/entries/${entryPublicId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(204);
  });

  test('8. 削除されたエントリーは取得できない', async () => {
    const response = await request(app)
      .get(`/entries/${entryPublicId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
  });
});
