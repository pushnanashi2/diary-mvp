const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');

describe('Sharing API Integration Tests', () => {
  let authToken;
  let userId;
  let entryId;
  let shareToken;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `sharing_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Sharing Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    const entryRes = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Test entry for sharing',
        mood: 'excited'
      });
    
    entryId = entryRes.body.id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM share_links WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  describe('POST /api/sharing/links', () => {
    it('共有リンクを作成できること', async () => {
      const res = await request(app)
        .post('/api/sharing/links')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entry_id: entryId,
          expires_in_days: 7,
          allow_comments: true
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('share_token');
      expect(res.body).toHaveProperty('share_url');
      expect(res.body.allow_comments).toBe(true);
      
      shareToken = res.body.share_token;
    });

    it('存在しないエントリーで404エラーを返すこと', async () => {
      const res = await request(app)
        .post('/api/sharing/links')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entry_id: '01HZZZZZZZZZZZZZZZZZZZZZZ',
          expires_in_days: 7
        });

      expect(res.status).toBe(404);
    });

    it('無効な有効期限で400エラーを返すこと', async () => {
      const res = await request(app)
        .post('/api/sharing/links')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entry_id: entryId,
          expires_in_days: 400
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/sharing/:token', () => {
    it('共有リンクからエントリーを取得できること', async () => {
      const res = await request(app)
        .get(`/api/sharing/${shareToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('entry');
      expect(res.body.entry.content).toBe('Test entry for sharing');
    });

    it('無効なトークンで404エラーを返すこと', async () => {
      const res = await request(app)
        .get('/api/sharing/invalid_token_12345');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/sharing/links/:id', () => {
    it('共有リンクを削除できること', async () => {
      const createRes = await request(app)
        .post('/api/sharing/links')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entry_id: entryId,
          expires_in_days: 1
        });

      const linkId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/sharing/links/${linkId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('削除');
    });

    it('他人の共有リンクを削除できないこと', async () => {
      // 別のユーザーを作成
      const user2Res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `sharing2_${Date.now()}@test.com`,
          password: 'TestPass123!',
          name: 'User 2'
        });

      const res = await request(app)
        .delete(`/api/sharing/links/${shareToken}`)
        .set('Authorization', `Bearer ${user2Res.body.token}`);

      expect(res.status).toBe(403);

      // クリーンアップ
      await db.query('DELETE FROM users WHERE id = $1', [user2Res.body.user.id]);
    });
  });

  describe('GET /api/sharing/links', () => {
    it('自分の共有リンク一覧を取得できること', async () => {
      const res = await request(app)
        .get('/api/sharing/links')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });
});