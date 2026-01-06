/**
 * ユーザー関連のSQLクエリ
 */

// ユーザー作成
export async function createUser(pool, email, passwordHash) {
  const [result] = await pool.query(
    `INSERT INTO users(email, password_hash) VALUES (?,?)`,
    [email, passwordHash]
  );
  return result.insertId;
}

// メールでユーザー検索
export async function findUserByEmail(pool, email) {
  const [rows] = await pool.query(
    `SELECT id, password_hash FROM users WHERE email=?`,
    [email]
  );
  return rows[0] || null;
}

// ユーザーIDでユーザー情報取得
export async function getUserById(pool, userId) {
  const [rows] = await pool.query(
    `SELECT id, email, default_summary_template FROM users WHERE id=?`,
    [userId]
  );
  return rows[0] || null;
}

// デフォルトテンプレート更新
export async function updateDefaultTemplate(pool, userId, templateId) {
  await pool.query(
    `UPDATE users SET default_summary_template=? WHERE id=?`,
    [templateId, userId]
  );
}

// ユーザー削除
export async function deleteUser(pool, userId) {
  await pool.query(
    `DELETE FROM users WHERE id=?`,
    [userId]
  );
}

// デフォルトテンプレート取得
export async function getDefaultTemplate(pool, userId) {
  const [rows] = await pool.query(
    `SELECT default_summary_template FROM users WHERE id=?`,
    [userId]
  );
  return rows[0]?.default_summary_template || 'default';
}
