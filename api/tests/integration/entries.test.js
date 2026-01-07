/**
 * Entries Integration Tests
 * エントリーAPIの統合テスト
 */

import request from 'supertest';
import app from '../../server.js';
import { getPool } from '../../config/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Entries API', () => {
  let pool;
  let authToken;
  let userId;

  beforeAll(async () => {
    pool = getPool();

    // テストユーザーを作成
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        email: 'entries-test@example.com',
        password: 'password123'
      });

    authToken = registerResponse.body.access_token;
    userId = registerResponse.body.user_id;
  });

  afterAll(async () => {
    // テストデータをクリア
    await pool.query('DELETE FROM entries WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  });

  describe('POST /entries', () => {
    test('認証済みユーザーがエントリーを作成できる', async () => {
      const testAudioPath = path.join(__dirname, '../fixtures/test-audio.m4a');

      const response = await request(app)
        .post('/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', testAudioPath);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('public_id');
      expect(response.body).toHaveProperty('title');
      expect(response.body.status).toBe('processing');
    });

    test('認証なしでエントリー作成を拒否する', async () => {
      const response = await request(app)
        .post('/entries')
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe('GET /entries', () => {
    test('認証済みユーザーがエントリー一覧を取得できる', async () => {
      const response = await request(app)
        .get('/entries')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('entries');
      expect(Array.isArray(response.body.entries)).toBe(true);
    });

    test('認証なしでエントリー一覧取得を拒否する', async () => {
      const response = await request(app)
        .get('/entries');

      expect(response.status).toBe(401);
    });
  });
});
