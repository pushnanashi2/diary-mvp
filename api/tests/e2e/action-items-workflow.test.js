/**
 * Action Items Workflow E2E Test
 * アクションアイテムのワークフローテスト
 */

import request from 'supertest';
import app from '../../server.js';
import { getPool } from '../../config/database.js';

describe('Action Items Workflow E2E', () => {
  let pool;
  let authToken;
  let userId;
  let entryId;
  let actionItemPublicId;

  beforeAll(async () => {
    pool = getPool();

    // テストユーザー作成
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        email: `action-items-${Date.now()}@example.com`,
        password: 'password123'
      });

    authToken = registerResponse.body.access_token;
    userId = registerResponse.body.user_id;

    // テストエントリー作成
    const [result] = await pool.query(
      'INSERT INTO entries (user_id, public_id, title, audio_url, status) VALUES (?, ?, ?, ?, ?)',
      [userId, 'TEST-ENTRY-AI', 'Test Entry', 's3://test/audio.m4a', 'done']
    );
    entryId = result.insertId;
  });

  afterAll(async () => {
    if (userId) {
      await pool.query('DELETE FROM action_items WHERE user_id = ?', [userId]);
      await pool.query('DELETE FROM entries WHERE user_id = ?', [userId]);
      await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    }
  });

  test('1. アクションアイテム作成', async () => {
    const [result] = await pool.query(
      'INSERT INTO action_items (entry_id, user_id, public_id, title, priority, status) VALUES (?, ?, ?, ?, ?, ?)',
      [entryId, userId, 'TEST-ACTION-001', 'Test Action Item', 'high', 'pending']
    );

    actionItemPublicId = 'TEST-ACTION-001';
    expect(result.affectedRows).toBe(1);
  });

  test('2. アクションアイテム一覧取得', async () => {
    const response = await request(app)
      .get('/action-items')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.action_items.length).toBeGreaterThan(0);
  });

  test('3. 特定アクションアイテム取得', async () => {
    const response = await request(app)
      .get(`/action-items/${actionItemPublicId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.public_id).toBe(actionItemPublicId);
  });

  test('4. アクションアイテムを完了に更新', async () => {
    const response = await request(app)
      .patch(`/action-items/${actionItemPublicId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'completed' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
    expect(response.body.completed_at).toBeTruthy();
  });

  test('5. 期限切れアイテム取得', async () => {
    // 過去の期限でアイテム作成
    await pool.query(
      'INSERT INTO action_items (entry_id, user_id, public_id, title, priority, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [entryId, userId, 'TEST-ACTION-002', 'Overdue Item', 'urgent', 'pending', '2020-01-01']
    );

    const response = await request(app)
      .get('/action-items/overdue')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.action_items.length).toBeGreaterThan(0);
  });

  test('6. アクションアイテム削除', async () => {
    const response = await request(app)
      .delete(`/action-items/${actionItemPublicId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(204);
  });
});
