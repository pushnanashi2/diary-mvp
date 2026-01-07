const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');

describe('Reminders API Integration Tests', () => {
  let authToken;
  let userId;
  let reminderId;
  let entryId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `reminders_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Reminders Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    const entryRes = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Test entry for reminders',
        mood: 'happy'
      });
    
    entryId = entryRes.body.id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM reminders WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  describe('POST /api/reminders', () => {
    it('リマインダーを作成できること', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Reminder',
          message: 'This is a test reminder',
          remind_at: futureDate.toISOString(),
          type: 'general'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Test Reminder');
      expect(res.body.status).toBe('pending');
      
      reminderId = res.body.id;
    });

    it('エントリー関連リマインダーを作成できること', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Entry Reminder',
          message: 'Check this entry',
          remind_at: futureDate.toISOString(),
          type: 'entry',
          entry_id: entryId
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('entry');
      expect(res.body.entry_id).toBe(entryId);
    });

    it('過去の日時で400エラーを返すこと', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Past Reminder',
          remind_at: pastDate.toISOString(),
          type: 'general'
        });

      expect(res.status).toBe(400);
    });

    it('繰り返しリマインダーを作成できること', async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Daily Reminder',
          message: 'Write your journal',
          remind_at: new Date(Date.now() + 3600000).toISOString(),
          type: 'recurring',
          recurrence_pattern: 'daily',
          recurrence_time: '20:00'
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('recurring');
      expect(res.body.recurrence_pattern).toBe('daily');
    });
  });

  describe('GET /api/reminders', () => {
    it('リマインダー一覧を取得できること', async () => {
      const res = await request(app)
        .get('/api/reminders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('ステータスでフィルタリングできること', async () => {
      const res = await request(app)
        .get('/api/reminders')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.forEach(reminder => {
        expect(reminder.status).toBe('pending');
      });
    });
  });

  describe('GET /api/reminders/:id', () => {
    it('リマインダー詳細を取得できること', async () => {
      const res = await request(app)
        .get(`/api/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(reminderId);
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('PATCH /api/reminders/:id', () => {
    it('リマインダーを更新できること', async () => {
      const res = await request(app)
        .patch(`/api/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Reminder',
          message: 'Updated message'
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Reminder');
      expect(res.body.message).toBe('Updated message');
    });

    it('リマインダーを完了にできること', async () => {
      const res = await request(app)
        .patch(`/api/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
    });
  });

  describe('DELETE /api/reminders/:id', () => {
    it('リマインダーを削除できること', async () => {
      const res = await request(app)
        .delete(`/api/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      const checkRes = await request(app)
        .get(`/api/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(checkRes.status).toBe(404);
    });
  });
});