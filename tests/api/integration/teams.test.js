const request = require('supertest');
const app = require('../../../api/server');
const db = require('../../../api/config/database');

describe('Teams API Integration Tests', () => {
  let authToken1, authToken2;
  let userId1, userId2;
  let teamId;

  beforeAll(async () => {
    // ユーザー1の登録
    const signup1 = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `team_owner_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Team Owner'
      });
    userId1 = signup1.body.user.id;
    authToken1 = signup1.body.token;

    // ユーザー2の登録
    const signup2 = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `team_member_${Date.now()}@test.com`,
        password: 'TestPass123!',
        name: 'Team Member'
      });
    userId2 = signup2.body.user.id;
    authToken2 = signup2.body.token;
  });

  afterAll(async () => {
    await db.query('DELETE FROM team_members WHERE team_id = $1', [teamId]);
    await db.query('DELETE FROM teams WHERE id = $1', [teamId]);
    await db.query('DELETE FROM users WHERE id IN ($1, $2)', [userId1, userId2]);
    await db.end();
  });

  describe('POST /api/teams', () => {
    it('チームを作成できること', async () => {
      const res = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          name: 'Test Team',
          description: 'Team for integration testing'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Team');
      expect(res.body.owner_id).toBe(userId1);
      
      teamId = res.body.id;
    });

    it('名前なしで400エラーを返すこと', async () => {
      const res = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ description: 'No name team' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/teams/:teamId/members', () => {
    it('メンバーを追加できること', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          user_id: userId2,
          role: 'member'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user_id');
      expect(res.body.user_id).toBe(userId2);
      expect(res.body.role).toBe('member');
    });

    it('オーナー以外はメンバー追加できないこと', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          user_id: userId1,
          role: 'member'
        });

      expect(res.status).toBe(403);
    });

    it('無効なロールで400エラーを返すこと', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          user_id: userId2,
          role: 'superadmin'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/teams/:teamId', () => {
    it('チーム詳細を取得できること', async () => {
      const res = await request(app)
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(teamId);
      expect(res.body).toHaveProperty('members');
      expect(Array.isArray(res.body.members)).toBe(true);
    });

    it('メンバーもチーム情報を取得できること', async () => {
      const res = await request(app)
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken2}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(teamId);
    });
  });

  describe('GET /api/teams', () => {
    it('自分のチーム一覧を取得できること', async () => {
      const res = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${authToken1}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/teams/:teamId/members/:userId', () => {
    it('メンバーのロールを変更できること', async () => {
      const res = await request(app)
        .patch(`/api/teams/${teamId}/members/${userId2}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('admin');
    });
  });

  describe('DELETE /api/teams/:teamId/members/:userId', () => {
    it('メンバーを削除できること', async () => {
      const res = await request(app)
        .delete(`/api/teams/${teamId}/members/${userId2}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(res.status).toBe(200);
    });
  });
});