const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');
const { ulid } = require('ulid');

describe('Summaries API Integration Tests', () => {
  let authToken;
  let userId;
  let entryId;

  beforeAll(async () => {
    // ユーザー登録とログイン
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `summaries_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Summary Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // テスト用エントリー作成
    const entryRes = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Test entry for summary generation',
        mood: 'happy'
      });
    
    entryId = entryRes.body.id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  describe('GET /api/summaries/weekly', () => {
    it('週次サマリーを取得できること', async () => {
      const res = await request(app)
        .get('/api/summaries/weekly')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('period');
      expect(res.body.period).toHaveProperty('start');
      expect(res.body.period).toHaveProperty('end');
    });

    it('認証なしで403エラーを返すこと', async () => {
      const res = await request(app)
        .get('/api/summaries/weekly');

      expect(res.status).toBe(403);
    });

    it('カスタム期間でサマリーを取得できること', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);
      const endDate = new Date();

      const res = await request(app)
        .get('/api/summaries/weekly')
        .query({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.period.start).toBe(startDate.toISOString().split('T')[0]);
    });
  });

  describe('GET /api/summaries/monthly', () => {
    it('月次サマリーを取得できること', async () => {
      const res = await request(app)
        .get('/api/summaries/monthly')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('stats');
    });

    it('指定月のサマリーを取得できること', async () => {
      const res = await request(app)
        .get('/api/summaries/monthly')
        .query({ month: '2026-01' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
    });
  });

  describe('POST /api/summaries/generate', () => {
    it('カスタムサマリーを生成できること', async () => {
      const res = await request(app)
        .post('/api/summaries/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          period: 'custom',
          start_date: '2026-01-01',
          end_date: '2026-01-07',
          include_insights: true
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('insights');
    });

    it('無効な日付範囲で400エラーを返すこと', async () => {
      const res = await request(app)
        .post('/api/summaries/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          period: 'custom',
          start_date: '2026-01-07',
          end_date: '2026-01-01'
        });

      expect(res.status).toBe(400);
    });
  });
});