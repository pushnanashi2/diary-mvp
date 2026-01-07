const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');

describe('Performance Tests', () => {
  let authToken;
  let userId;
  let entryIds = [];

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `perf_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Performance Tester'
      });
    
    userId = signupRes.body.user.id;
    authToken = signupRes.body.token;

    // テスト用データ作成
    for (let i = 0; i < 50; i++) {
      const res = await request(app)
        .post('/api/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: `Performance test entry ${i}`,
          mood: ['happy', 'sad', 'neutral', 'excited', 'calm'][i % 5]
        });
      entryIds.push(res.body.id);
    }
  });

  afterAll(async () => {
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.end();
  });

  describe('Response Time Tests', () => {
    it('エントリー一覧取得が1秒以内に完了すること', async () => {
      const start = Date.now();
      
      const res = await request(app)
        .get('/api/entries')
        .set('Authorization', `Bearer ${authToken}`);
      
      const duration = Date.now() - start;
      
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    it('個別エントリー取得が500ms以内に完了すること', async () => {
      const start = Date.now();
      
      const res = await request(app)
        .get(`/api/entries/${entryIds[0]}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      const duration = Date.now() - start;
      
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('検索が2秒以内に完了すること', async () => {
      const start = Date.now();
      
      const res = await request(app)
        .get('/api/search/fulltext')
        .query({ q: 'test' })
        .set('Authorization', `Bearer ${authToken}`);
      
      const duration = Date.now() - start;
      
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Pagination Performance', () => {
    it('ページネーションが効率的に動作すること', async () => {
      const res1 = await request(app)
        .get('/api/entries')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      const res2 = await request(app)
        .get('/api/entries')
        .query({ page: 2, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.length).toBeLessThanOrEqual(10);
      expect(res2.body.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Bulk Operations', () => {
    it('複数エントリーの削除が効率的に実行されること', async () => {
      const testEntryIds = entryIds.slice(0, 5);
      const start = Date.now();

      const promises = testEntryIds.map(id =>
        request(app)
          .delete(`/api/entries/${id}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Cache Performance', () => {
    it('キャッシュが機能してパフォーマンスが向上すること', async () => {
      const entryId = entryIds[10];

      // 初回アクセス
      const start1 = Date.now();
      await request(app)
        .get(`/api/entries/${entryId}`)
        .set('Authorization', `Bearer ${authToken}`);
      const duration1 = Date.now() - start1;

      // 2回目アクセス（キャッシュされるはず）
      const start2 = Date.now();
      await request(app)
        .get(`/api/entries/${entryId}`)
        .set('Authorization', `Bearer ${authToken}`);
      const duration2 = Date.now() - start2;

      // 2回目が高速か同程度のはず
      expect(duration2).toBeLessThanOrEqual(duration1 * 1.5);
    });
  });

  describe('Memory Usage', () => {
    it('大量データ取得時にメモリリークがないこと', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/entries')
          .set('Authorization', `Bearer ${authToken}`);
      }

      // ガベージコレクションを促す
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // メモリ増加が適切な範囲内（50MB以下）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});