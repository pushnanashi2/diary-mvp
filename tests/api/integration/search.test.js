const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');

describe('Search API Integration Tests', () => {
  let authToken;
  let userId;
  let entryIds = [];

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `search_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Search Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // 複数のテストエントリー作成
    const testEntries = [
      { content: 'Today I learned about machine learning', mood: 'excited' },
      { content: 'Went to the gym and felt great', mood: 'energetic' },
      { content: 'Meeting with the team was productive', mood: 'satisfied' },
      { content: 'Relaxing evening with a good book', mood: 'calm' }
    ];

    for (const entry of testEntries) {
      const res = await request(app)
        .post('/api/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send(entry);
      entryIds.push(res.body.id);
    }

    // 検索インデックス構築を待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  describe('GET /api/search/fulltext', () => {
    it('全文検索でエントリーを検索できること', async () => {
      const res = await request(app)
        .get('/api/search/fulltext')
        .query({ q: 'machine learning' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.results[0].content).toContain('machine learning');
    });

    it('クエリなしで400エラーを返すこと', async () => {
      const res = await request(app)
        .get('/api/search/fulltext')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('ページネーションが正しく動作すること', async () => {
      const res = await request(app)
        .get('/api/search/fulltext')
        .query({ q: 'the', page: 1, limit: 2 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeLessThanOrEqual(2);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
    });
  });

  describe('GET /api/search/semantic', () => {
    it('セマンティック検索でエントリーを検索できること', async () => {
      const res = await request(app)
        .get('/api/search/semantic')
        .query({ q: 'exercise and health' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      // セマンティック検索なので、「gym」を含むエントリーも見つかる
      if (res.body.results.length > 0) {
        expect(res.body.results[0]).toHaveProperty('similarity_score');
      }
    });

    it('類似度スコアが正しく返されること', async () => {
      const res = await request(app)
        .get('/api/search/semantic')
        .query({ q: 'work meeting', threshold: 0.5 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.results.length > 0) {
        res.body.results.forEach(result => {
          expect(result.similarity_score).toBeGreaterThanOrEqual(0);
          expect(result.similarity_score).toBeLessThanOrEqual(1);
        });
      }
    });
  });

  describe('GET /api/search/advanced', () => {
    it('詳細検索で複数条件を組み合わせられること', async () => {
      const res = await request(app)
        .get('/api/search/advanced')
        .query({
          q: 'meeting',
          mood: 'satisfied',
          date_from: '2026-01-01',
          date_to: '2026-12-31'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
    });

    it('感情フィルタが正しく動作すること', async () => {
      const res = await request(app)
        .get('/api/search/advanced')
        .query({ mood: 'calm' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.results.length > 0) {
        res.body.results.forEach(result => {
          expect(result.mood).toBe('calm');
        });
      }
    });

    it('日付範囲フィルタが正しく動作すること', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get('/api/search/advanced')
        .query({
          date_from: today,
          date_to: today
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
    });
  });
});