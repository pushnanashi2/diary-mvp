const request = require('supertest');
const app = require('../../api/server');

describe('Basic API Tests', () => {
  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Server exports', () => {
    it('should export express app', () => {
      expect(app).toBeDefined();
      expect(typeof app).toBe('function');
    });
  });
});
