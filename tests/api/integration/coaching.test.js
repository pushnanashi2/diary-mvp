const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');

describe('Coaching API Integration Tests', () => {
  let authToken;
  let userId;
  let sessionId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `coaching_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Coaching Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // テスト用エントリー作成
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: `Entry for coaching session ${i}`,
          mood: ['anxious', 'stressed', 'overwhelmed'][i]
        });
    }
  });

  afterAll(async () => {
    await db.query('DELETE FROM coaching_sessions WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  describe('POST /api/coaching/sessions', () => {
    it('コーチングセッションを開始できること', async () => {
      const res = await request(app)
        .post('/api/coaching/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          topic: 'stress_management',
          context: 'Feeling overwhelmed with work'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('session_id');
      expect(res.body).toHaveProperty('initial_message');
      expect(res.body.topic).toBe('stress_management');
      
      sessionId = res.body.session_id;
    });

    it('無効なトピックで400エラーを返すこと', async () => {
      const res = await request(app)
        .post('/api/coaching/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          topic: 'invalid_topic',
          context: 'Some context'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/coaching/sessions/:sessionId/messages', () => {
    it('セッションにメッセージを送信できること', async () => {
      const res = await request(app)
        .post(`/api/coaching/sessions/${sessionId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'I have been working long hours and cannot relax'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('response');
      expect(res.body).toHaveProperty('suggestions');
      expect(Array.isArray(res.body.suggestions)).toBe(true);
    });

    it('空のメッセージで400エラーを返すこと', async () => {
      const res = await request(app)
        .post(`/api/coaching/sessions/${sessionId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: '' });

      expect(res.status).toBe(400);
    });

    it('存在しないセッションで404エラーを返すこと', async () => {
      const res = await request(app)
        .post('/api/coaching/sessions/01HZZZZZZZZZZZZZZZZZZZZZZ/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Test message' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/coaching/sessions/:sessionId', () => {
    it('セッション詳細を取得できること', async () => {
      const res = await request(app)
        .get(`/api/coaching/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sessionId);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/coaching/sessions', () => {
    it('セッション一覧を取得できること', async () => {
      const res = await request(app)
        .get('/api/coaching/sessions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/coaching/sessions/:sessionId', () => {
    it('セッションを終了できること', async () => {
      const res = await request(app)
        .patch(`/api/coaching/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(res.body).toHaveProperty('ended_at');
    });
  });

  describe('GET /api/coaching/insights', () => {
    it('コーチングインサイトを取得できること', async () => {
      const res = await request(app)
        .get('/api/coaching/insights')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('insights');
      expect(res.body).toHaveProperty('progress');
      expect(res.body).toHaveProperty('recommendations');
    });
  });
});