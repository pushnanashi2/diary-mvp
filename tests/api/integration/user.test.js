/**
 * ユーザー設定API統合テスト（Notion仕様準拠）
 * 
 * 参照: Notion「06-2. ユーザー設定（User）」
 * 
 * エンドポイント:
 * - GET /me - ログインユーザー情報取得
 * - PUT /me/default-summary-template - デフォルト要約テンプレート変更
 * - DELETE /me - ユーザー全削除
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../api/server.js';
import db from '../../../api/config/database.js';

describe('GET /me - Notion仕様準拠', () => {
  let authToken;
  let userId;
  const testEmail = `me_test_${Date.now()}@test.com`;
  const testName = 'Me Test User';

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: testEmail,
        password: 'TestPass123!',
        name: testName
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  it('ログインユーザー情報取得（200）', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.id).toBe(userId);
    expect(res.body.email).toBe(testEmail);
    expect(res.body.name).toBe(testName);
    expect(res.body).toHaveProperty('default_summary_template');
    expect(res.body).toHaveProperty('created_at');
  });

  it('認証なしで401エラー', async () => {
    const res = await request(app)
      .get('/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('無効なtokenで401エラー', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', 'Bearer invalid_token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('PUT /me/default-summary-template - Notion仕様準拠', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: `template_test_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Template Test User'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  it('デフォルトテンプレート変更（200）', async () => {
    const res = await request(app)
      .put('/me/default-summary-template')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        template_id: 'bullet'
      });

    expect(res.status).toBe(200);
    expect(res.body.default_summary_template).toBe('bullet');

    // 変更確認
    const meRes = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(meRes.body.default_summary_template).toBe('bullet');
  });

  it('無効なtemplate_idで400エラー', async () => {
    const res = await request(app)
      .put('/me/default-summary-template')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        template_id: 'invalid_template'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('template_idなしで400エラー', async () => {
    const res = await request(app)
      .put('/me/default-summary-template')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('DELETE /me - Notion仕様準拠', () => {
  it('ユーザー全削除（204）', async () => {
    // 削除用ユーザー作成
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: `delete_me_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Delete Me User'
      });
    
    const authToken = signupRes.body.token;
    const userId = signupRes.body.user.id;

    // エントリ作成（削除確認用）
    await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: '削除テストエントリ',
        mood: 'neutral'
      });

    // ユーザー削除
    const res = await request(app)
      .delete('/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(204);

    // 削除確認
    const meRes = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(meRes.status).toBe(401); // tokenが無効に

    // DB確認（ユーザーが完全に削除されている）
    const dbUser = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    expect(dbUser.rows.length).toBe(0);
  });

  it('認証なしで401エラー', async () => {
    const res = await request(app)
      .delete('/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('ユーザー削除の不可逆性確認', () => {
  afterAll(async () => {
    await db.end();
  });

  it('ユーザー削除後、関連データが全て削除されること', async () => {
    // ユーザー作成
    const signupRes = await request(app)
      .post('/auth/register')
      .send({
        email: `cascade_test_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Cascade Test User'
      });
    
    const authToken = signupRes.body.token;
    const userId = signupRes.body.user.id;

    // エントリ作成
    const entryRes = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'カスケード削除テスト',
        mood: 'neutral'
      });
    const entryId = entryRes.body.id;

    // ユーザー削除
    await request(app)
      .delete('/me')
      .set('Authorization', `Bearer ${authToken}`);

    // エントリも削除されていることを確認
    const dbEntry = await db.query(
      'SELECT * FROM entries WHERE id = $1',
      [entryId]
    );
    expect(dbEntry.rows.length).toBe(0);
  });
});
