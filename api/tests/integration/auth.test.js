/**
 * Auth Integration Tests
 * 認証APIの統合テスト
 */

import request from 'supertest';
import app from '../../server.js';
import { getPool } from '../../config/database.js';

describe('Auth API', () => {
  let pool;

  beforeAll(() => {
    pool = getPool();
  });

  beforeEach(async () => {
    // テストデータをクリア
    await pool.query('DELETE FROM users WHERE email LIKE "test%@example.com"');
  });

  describe('POST /auth/register', () => {
    test('新規ユーザー登録が成功する', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test1@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user_id');
      expect(response.body).toHaveProperty('access_token');
    });

    test('重複メールアドレスを拒否する', async () => {
      const userData = {
        email: 'test2@example.com',
        password: 'password123'
      };

      // 1回目の登録
      await request(app).post('/auth/register').send(userData);

      // 2回目の登録（重複）
      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    test('無効なメールアドレスを拒否する', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // テストユーザーを作成
      await request(app)
        .post('/auth/register')
        .send({
          email: 'test3@example.com',
          password: 'password123'
        });
    });

    test('正しい認証情報でログインできる', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test3@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user_id');
      expect(response.body).toHaveProperty('access_token');
    });

    test('間違ったパスワードでログインを拒否する', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test3@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('存在しないユーザーでログインを拒否する', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
    });
  });
});
