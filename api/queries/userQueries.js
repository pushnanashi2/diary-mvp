/**
 * User Queries (with missing getUserByEmail)
 */

export async function createUser(pool, email, passwordHash) {
  const [result] = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    [email, passwordHash]
  );
  return result.insertId;
}

export async function getUserById(pool, userId) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
}

export async function getUserByEmail(pool, email) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  return rows[0] || null;
}

export async function updateDefaultTemplate(pool, userId, templateId) {
  const [result] = await pool.query(
    'UPDATE users SET default_summary_template = ? WHERE id = ?',
    [templateId, userId]
  );
  return result.affectedRows;
}

export async function deleteUser(pool, userId) {
  const [result] = await pool.query(
    'DELETE FROM users WHERE id = ?',
    [userId]
  );
  return result.affectedRows;
}
