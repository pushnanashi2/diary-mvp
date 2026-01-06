/**
 * エントリ関連のSQLクエリ
 */

// エントリ作成
export async function createEntry(pool, userId, title, audioUrl) {
  const [result] = await pool.query(
    `INSERT INTO entries(user_id, title, audio_url) VALUES (?,?,?)`,
    [userId, title, audioUrl]
  );
  return result.insertId;
}

// エントリ一覧取得
export async function listEntries(pool, userId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT id, title, created_at, summary_text, pii_detected, pii_types, pii_acknowledged, content_flagged, flag_types
     FROM entries WHERE user_id=? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

// エントリ詳細取得
export async function getEntryById(pool, entryId, userId) {
  const [rows] = await pool.query(
    `SELECT id, title, created_at, audio_url, transcript_text, summary_text, pii_detected, pii_types, pii_acknowledged, content_flagged, flag_types
     FROM entries WHERE id=? AND user_id=?`,
    [entryId, userId]
  );
  return rows[0] || null;
}

// エントリのaudio_url取得
export async function getEntryAudioUrl(pool, entryId, userId) {
  const [rows] = await pool.query(
    `SELECT audio_url FROM entries WHERE id=? AND user_id=?`,
    [entryId, userId]
  );
  return rows[0]?.audio_url || null;
}

// エントリ削除
export async function deleteEntry(pool, entryId, userId) {
  await pool.query(
    `DELETE FROM entries WHERE id=? AND user_id=?`,
    [entryId, userId]
  );
}

// ユーザーの全エントリのaudio_url取得
export async function getAllAudioUrlsByUser(pool, userId) {
  const [rows] = await pool.query(
    `SELECT audio_url FROM entries WHERE user_id=?`,
    [userId]
  );
  return rows;
}

// IDでエントリが存在するかチェック
export async function checkEntryExists(pool, entryId, userId) {
  const [rows] = await pool.query(
    `SELECT id FROM entries WHERE id=? AND user_id=?`,
    [entryId, userId]
  );
  return rows[0] ? true : false;
}
