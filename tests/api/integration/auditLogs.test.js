const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');

describe('Audit Logs API Integration Tests', () => {
  let authToken;
  let userId;
  let entryId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `audit_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Audit Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // 監査ログを生成するためのアクション実行
    const entryRes = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Entry for audit log testing',
        mood: 'neutral'
      });
    
    entryId = entryRes.body.id;

    // エントリー更新
    await request(app)
      .put(`/api/entries/${entryId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Updated entry content',
        mood: 'happy'
      });

    // ログ生成を待つ
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    await db.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  describe('GET /api/audit-logs', () => {
    it('監査ログ一覧を取得できること', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('アクションでフィルタリングできること', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .query({ action: 'entry.create' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.forEach(log => {
        expect(log.action).toBe('entry.create');
      });
    });

    it('日付範囲でフィルタリングできること', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get('/api/audit-logs')
        .query({
          date_from: today,
          date_to: today
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('ページネーションが正しく動作すること', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .query({ page: 1, limit: 5 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/audit-logs/stats', () => {
    it('監査ログ統計を取得できること', async () => {
      const res = await request(app)
        .get('/api/audit-logs/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total_actions');
      expect(res.body).toHaveProperty('actions_by_type');
      expect(res.body).toHaveProperty('recent_activity');
    });

    it('期間指定で統計を取得できること', async () => {
      const res = await request(app)
        .get('/api/audit-logs/stats')
        .query({ period: 'last_7_days' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('period');
      expect(res.body.period).toBe('last_7_days');
    });
  });

  describe('GET /api/audit-logs/:id', () => {
    it('監査ログ詳細を取得できること', async () => {
      const listRes = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`);

      const logId = listRes.body[0].id;

      const res = await request(app)
        .get(`/api/audit-logs/${logId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(logId);
      expect(res.body).toHaveProperty('action');
      expect(res.body).toHaveProperty('resource_type');
      expect(res.body).toHaveProperty('resource_id');
      expect(res.body).toHaveProperty('metadata');
    });

    it('存在しないログで404エラーを返すこと', async () => {
      const res = await request(app)
        .get('/api/audit-logs/01HZZZZZZZZZZZZZZZZZZZZZZ')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/audit-logs/export', () => {
    it('監査ログをエクスポートできること', async () => {
      const res = await request(app)
        .get('/api/audit-logs/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('logs');
      expect(res.body).toHaveProperty('export_date');
      expect(Array.isArray(res.body.logs)).toBe(true);
    });

    it('CSV形式でエクスポートできること', async () => {
      const res = await request(app)
        .get('/api/audit-logs/export')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });
});