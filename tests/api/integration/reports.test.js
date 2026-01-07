const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');

describe('Reports API Integration Tests', () => {
  let authToken;
  let userId;
  let reportId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `reports_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Reports Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // テスト用エントリー作成
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: `Test entry ${i} for reports`,
          mood: ['happy', 'calm', 'excited'][i % 3]
        });
    }
  });

  afterAll(async () => {
    await db.query('DELETE FROM scheduled_reports WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  describe('POST /api/reports/schedule', () => {
    it('定期レポートをスケジュールできること', async () => {
      const res = await request(app)
        .post('/api/reports/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frequency: 'weekly',
          day_of_week: 1,
          time: '09:00',
          timezone: 'Asia/Tokyo',
          format: 'email'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.frequency).toBe('weekly');
      expect(res.body.is_active).toBe(true);
      
      reportId = res.body.id;
    });

    it('無効な頻度で400エラーを返すこと', async () => {
      const res = await request(app)
        .post('/api/reports/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frequency: 'hourly',
          format: 'email'
        });

      expect(res.status).toBe(400);
    });

    it('月次レポートをスケジュールできること', async () => {
      const res = await request(app)
        .post('/api/reports/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frequency: 'monthly',
          day_of_month: 1,
          time: '10:00',
          timezone: 'Asia/Tokyo',
          format: 'pdf'
        });

      expect(res.status).toBe(201);
      expect(res.body.frequency).toBe('monthly');
      expect(res.body.format).toBe('pdf');
    });
  });

  describe('GET /api/reports/scheduled', () => {
    it('スケジュールされたレポート一覧を取得できること', async () => {
      const res = await request(app)
        .get('/api/reports/scheduled')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/reports/schedule/:id', () => {
    it('レポート設定を更新できること', async () => {
      const res = await request(app)
        .patch(`/api/reports/schedule/${reportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frequency: 'daily',
          time: '08:00'
        });

      expect(res.status).toBe(200);
      expect(res.body.frequency).toBe('daily');
      expect(res.body.time).toBe('08:00');
    });

    it('レポートを停止できること', async () => {
      const res = await request(app)
        .patch(`/api/reports/schedule/${reportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.is_active).toBe(false);
    });
  });

  describe('DELETE /api/reports/schedule/:id', () => {
    it('スケジュールされたレポートを削除できること', async () => {
      const res = await request(app)
        .delete(`/api/reports/schedule/${reportId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/reports/generate', () => {
    it('オンデマンドレポートを生成できること', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'summary',
          period: 'last_7_days',
          format: 'json'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('report');
      expect(res.body.report).toHaveProperty('summary');
    });

    it('PDF形式でレポートを生成できること', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'detailed',
          period: 'last_30_days',
          format: 'pdf'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('url');
    });
  });
});