const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');

describe('Chat API Integration Tests', () => {
  let authToken;
  let userId;
  let conversationId;

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `chat_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Chat Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // テスト用エントリー作成
    await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'Had a great day at work today!',
        mood: 'happy'
      });
  });

  afterAll(async () => {
    await db.query('DELETE FROM chat_messages WHERE conversation_id = $1', [conversationId]);
    await db.query('DELETE FROM chat_conversations WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  describe('POST /api/chat/conversations', () => {
    it('会話を開始できること', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Conversation',
          context_type: 'general'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Test Conversation');
      
      conversationId = res.body.id;
    });

    it('エントリーコンテキストで会話を開始できること', async () => {
      const entryRes = await request(app)
        .get('/api/entries')
        .set('Authorization', `Bearer ${authToken}`);
      
      const entryId = entryRes.body[0].id;

      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Entry Discussion',
          context_type: 'entry',
          context_id: entryId
        });

      expect(res.status).toBe(201);
      expect(res.body.context_type).toBe('entry');
      expect(res.body.context_id).toBe(entryId);
    });
  });

  describe('POST /api/chat/conversations/:conversationId/messages', () => {
    it('メッセージを送信できること', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What were the key highlights of my week?'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user_message');
      expect(res.body).toHaveProperty('assistant_message');
      expect(res.body.user_message.content).toBe('What were the key highlights of my week?');
    });

    it('空のメッセージで400エラーを返すこと', async () => {
      const res = await request(app)
        .post(`/api/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: '' });

      expect(res.status).toBe(400);
    });

    it('存在しない会話で404エラーを返すこと', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/01HZZZZZZZZZZZZZZZZZZZZZZ/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Test' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/chat/conversations/:conversationId', () => {
    it('会話履歴を取得できること', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/chat/conversations', () => {
    it('会話一覧を取得できること', async () => {
      const res = await request(app)
        .get('/api/chat/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('ページネーションが正しく動作すること', async () => {
      const res = await request(app)
        .get('/api/chat/conversations')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(10);
    });
  });

  describe('DELETE /api/chat/conversations/:conversationId', () => {
    it('会話を削除できること', async () => {
      const createRes = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'To be deleted' });

      const deleteRes = await request(app)
        .delete(`/api/chat/conversations/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);
    });

    it('他人の会話を削除できないこと', async () => {
      const user2Res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `chat2_${Date.now()}@test.com`,
          password: 'TestPass123!',
          name: 'User 2'
        });

      const res = await request(app)
        .delete(`/api/chat/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${user2Res.body.token}`);

      expect(res.status).toBe(403);

      await db.query('DELETE FROM users WHERE id = $1', [user2Res.body.user.id]);
    });
  });

  describe('POST /api/chat/suggest', () => {
    it('質問サジェストを取得できること', async () => {
      const res = await request(app)
        .post('/api/chat/suggest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          context: 'I want to improve my productivity'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('suggestions');
      expect(Array.isArray(res.body.suggestions)).toBe(true);
      expect(res.body.suggestions.length).toBeGreaterThan(0);
    });
  });
});