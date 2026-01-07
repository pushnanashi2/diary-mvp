const request = require('supertest');

/**
 * テストユーザーを作成して認証トークンを返す
 */
async function createTestUser(app, email, password = 'TestPass123!', name = 'Test User') {
  const signupRes = await request(app)
    .post('/api/auth/signup')
    .send({ email, password, name });
  
  if (signupRes.status !== 201) {
    throw new Error(`Failed to create test user: ${signupRes.body.message || 'Unknown error'}`);
  }
  
  return {
    userId: signupRes.body.user.id,
    token: signupRes.body.token,
    user: signupRes.body.user
  };
}

/**
 * テストエントリーを作成
 */
async function createTestEntry(app, token, content = 'Test entry', mood = 'neutral') {
  const res = await request(app)
    .post('/api/entries')
    .set('Authorization', `Bearer ${token}`)
    .send({ content, mood });
  
  if (res.status !== 201) {
    throw new Error(`Failed to create test entry: ${res.body.message || 'Unknown error'}`);
  }
  
  return res.body;
}

/**
 * テストデータをクリーンアップ
 */
async function cleanupTestData(db, userId) {
  try {
    // 関連テーブルから削除（外部キー制約を考慮）
    await db.query('DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = $1)', [userId]);
    await db.query('DELETE FROM chat_conversations WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM coaching_sessions WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM reminders WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM action_items WHERE entry_id IN (SELECT id FROM entries WHERE user_id = $1)', [userId]);
    await db.query('DELETE FROM emotion_analyses WHERE entry_id IN (SELECT id FROM entries WHERE user_id = $1)', [userId]);
    await db.query('DELETE FROM keywords WHERE entry_id IN (SELECT id FROM entries WHERE user_id = $1)', [userId]);
    await db.query('DELETE FROM share_links WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM scheduled_reports WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM team_members WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

/**
 * ランダムなメールアドレスを生成
 */
function generateTestEmail(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@test.com`;
}

/**
 * 指定時間待機
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * APIレスポンスの検証ヘルパー
 */
function expectSuccessResponse(res, expectedStatus = 200) {
  expect(res.status).toBe(expectedStatus);
  expect(res.body).toBeDefined();
}

function expectErrorResponse(res, expectedStatus = 400) {
  expect(res.status).toBe(expectedStatus);
  expect(res.body).toHaveProperty('message');
}

module.exports = {
  createTestUser,
  createTestEntry,
  cleanupTestData,
  generateTestEmail,
  wait,
  expectSuccessResponse,
  expectErrorResponse
};
