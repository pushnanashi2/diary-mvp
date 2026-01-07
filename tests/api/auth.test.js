/**
 * 認証APIのテスト（Notion仕様準拠版）
 * 
 * 参照: Notion「06. API仕様一覧」
 * https://www.notion.so/06-API-2e0c742b052381578cd9f027ee91f469
 * 
 * 実行方法:
 * npm test tests/api/auth.test.js
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../api/server.js';
import db from '../../api/config/database.js';

describe('POST /auth/register - Notion仕様準拠', () => {
  afterAll(async () => {
    await db.end();
  });

  it('仕様通りの入力で成功すること（201 + user + token）', async () => {
    const input = {
      email: `test_${Date.now()}@example.com`,
      password: 'testpass123',
      name: 'Test User'
    };

    const res = await request(app)
      .post('/auth/register')
      .send(input);
    
    // ステータス検証
    expect(res.status).toBe(201);

    // 出力構造検証（Notion仕様）
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(typeof res.body.user.id).toBe('number');
    expect(res.body.user.email).toBe(input.email);
    expect(res.body.user.name).toBe(input.name);
    expect(res.body.user).toHaveProperty('created_at');
    
    // JWT検証
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token).toMatch(/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);

    // データベース検証
    const dbUser = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [input.email]
    );
    expect(dbUser.rows.length).toBe(1);
    expect(dbUser.rows[0].name).toBe(input.name);
  });

  it('必須フィールドが欠けている場合400エラー（BAD_REQUEST）', async () => {
    const requiredFields = ['email', 'password', 'name'];
    
    for (const field of requiredFields) {
      const input = {
        email: `test_${Date.now()}@example.com`,
        password: 'testpass123',
        name: 'Test User'
      };
      delete input[field];

      const res = await request(app)
        .post('/auth/register')
        .send(input);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBeDefined();
    }
  });

  it('メールアドレス形式が不正な場合400エラー', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'invalid-email',
        password: 'testpass123',
        name: 'Test User'
      });
    
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('パスワードが短すぎる場合400エラー', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: `test_${Date.now()}@example.com`,
        password: '123', // 短すぎる
        name: 'Test User'
      });
    
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('名前が空文字の場合400エラー', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: `test_${Date.now()}@example.com`,
        password: 'testpass123',
        name: '' // 空
      });
    
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('メールアドレスが既に存在する場合409エラー（EMAIL_EXISTS）', async () => {
    const email = `duplicate_${Date.now()}@example.com`;
    
    // 1回目: 成功
    await request(app)
      .post('/auth/register')
      .send({ email, password: 'testpass123', name: 'Test User' });
    
    // 2回目: 重複エラー
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'testpass123', name: 'Test User' });
    
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });
});

describe('POST /auth/login - Notion仕様準拠', () => {
  let testEmail;
  let testPassword = 'testpass123';
  let testName = 'Login Test User';

  beforeAll(async () => {
    // テスト用ユーザー作成
    testEmail = `login_test_${Date.now()}@example.com`;
    await request(app)
      .post('/auth/register')
      .send({ email: testEmail, password: testPassword, name: testName });
  });

  afterAll(async () => {
    await db.end();
  });

  it('正しい認証情報でログイン成功（200 + token）', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token).toMatch(/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
  });

  it('パスワードが間違っている場合401エラー（INVALID_CREDENTIALS）', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: 'wrongpassword' });
    
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('存在しないメールアドレスの場合401エラー', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'testpass123' });
    
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('emailフィールドが欠けている場合400エラー', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ password: testPassword });
    
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('passwordフィールドが欠けている場合400エラー', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: testEmail });
    
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('認証フロー統合テスト', () => {
  afterAll(async () => {
    await db.end();
  });

  it('登録→ログイン→認証が必要なAPIアクセスの一連のフロー', async () => {
    const email = `flow_test_${Date.now()}@example.com`;
    const password = 'testpass123';
    const name = 'Flow Test User';

    // 1. 登録
    const registerRes = await request(app)
      .post('/auth/register')
      .send({ email, password, name });
    
    expect(registerRes.status).toBe(201);
    const registerToken = registerRes.body.token;

    // 2. ログイン
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email, password });
    
    expect(loginRes.status).toBe(200);
    const loginToken = loginRes.body.token;

    // 3. 認証が必要なAPIにアクセス（例: GET /me）
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginToken}`);
    
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(email);
    expect(meRes.body.name).toBe(name);
  });
});
