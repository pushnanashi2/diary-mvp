/**
 * エントリ関連のSQLクエリ（public_id対応版）
 */

// エントリ作成（public_id追加）
export async function createEntry(pool, userId, publicId, title, audioUrl) {
  const [result] = await pool.query(
    `INSERT INTO entries(user_id, public_id, title, audio_url) VALUES (?,?,?,?)`,
    [userId, publicId, title, audioUrl]
  );
  return result.insertId;
}

// エントリ一覧取得（public_id返却）
export async function listEntries(pool, userId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT id, public_id, title, created_at, summary_text, pii_detected, pii_types, pii_acknowledged, content_flagged, flag_types
     FROM entries WHERE user_id=? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

// エントリ詳細取得（public_idで検索）
export async function getEntryByPublicId(pool, publicId, userId) {
  const [rows] = await pool.query(
    `SELECT id, public_id, title, created_at, audio_url, transcript_text, summary_text, pii_detected, pii_types, pii_acknowledged, content_flagged, flag_types
     FROM entries WHERE public_id=? AND user_id=?`,
    [publicId, userId]
  );
  return rows[0] || null;
}

// エントリのaudio_url取得（public_idで検索）
export async function getEntryAudioUrl(pool, publicId, userId) {
  const [rows] = await pool.query(
    `SELECT audio_url FROM entries WHERE public_id=? AND user_id=?`,
    [publicId, userId]
  );
  return rows[0]?.audio_url || null;
}

// エントリ削除（public_idで削除）
export async function deleteEntry(pool, publicId, userId) {
  await pool.query(
    `DELETE FROM entries WHERE public_id=? AND user_id=?`,
    [publicId, userId]
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

// public_idでエントリが存在するかチェック
export async function checkEntryExists(pool, publicId, userId) {
  const [rows] = await pool.query(
    `SELECT id FROM entries WHERE public_id=? AND user_id=?`,
    [publicId, userId]
  );
  return rows[0] ? true : false;
}

// 【後方互換】内部ID(id)でエントリ取得（Worker用）
export async function getEntryById(pool, entryId) {
  const [rows] = await pool.query(
    `SELECT id, public_id, user_id, title, audio_url, transcript_text, summary_text FROM entries WHERE id=?`,
    [entryId]
  );
  return rows[0] || null;
}
