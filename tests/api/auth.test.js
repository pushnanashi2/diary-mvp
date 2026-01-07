/**
 * 認証APIのテスト
 * 
 * 実行方法:
 * npm test tests/api/auth.test.js
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../api/server.js';

describe('POST /auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: `test_${Date.now()}@example.com`,
        password: 'testpass123'
      });
    
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user_id');
    expect(res.body).toHaveProperty('access_token');
  });

  it('should return 400 if email is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ password: 'testpass123' });
    
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('should return 409 if email already exists', async () => {
    const email = `duplicate_${Date.now()}@example.com`;
    
    // 1回目: 成功
    await request(app)
      .post('/auth/register')
      .send({ email, password: 'testpass123' });
    
    // 2回目: 重複エラー
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'testpass123' });
    
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });
});

describe('POST /auth/login', () => {
  let testEmail;
  let testPassword = 'testpass123';

  beforeAll(async () => {
    // テスト用ユーザー作成
    testEmail = `test_${Date.now()}@example.com`;
    await request(app)
      .post('/auth/register')
      .send({ email: testEmail, password: testPassword });
  });

  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
  });

  it('should return 401 with invalid password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: 'wrongpassword' });
    
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 with non-existent email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'testpass123' });
    
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
