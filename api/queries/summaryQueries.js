/**
 * 要約関連のSQLクエリ（public_id対応版）
 */

// 要約作成（public_id追加）
export async function createSummary(pool, userId, publicId, rangeStart, rangeEnd, templateId) {
  const [result] = await pool.query(
    `INSERT INTO summaries(user_id, public_id, range_start, range_end, status, template_id)
     VALUES (?,?,?,?, 'queued', ?)`,
    [userId, publicId, new Date(rangeStart), new Date(rangeEnd), templateId]
  );
  return result.insertId;
}

// 要約一覧取得（public_id返却）
export async function listSummaries(pool, userId, status, limit, offset) {
  let sql = `SELECT id, public_id, range_start, range_end, status, template_id, error_code, started_at, finished_at, created_at
             FROM summaries WHERE user_id=?`;
  const params = [userId];

  if (status) {
    sql += ` AND status=?`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  return rows;
}

// 要約詳細取得（public_idで検索）
export async function getSummaryByPublicId(pool, publicId, userId) {
  const [rows] = await pool.query(
    `SELECT id, public_id, range_start, range_end, status, template_id, summary_text, error_code, error_message, started_at, finished_at, created_at
     FROM summaries WHERE public_id=? AND user_id=?`,
    [publicId, userId]
  );
  return rows[0] || null;
}

// 要約のステータスをqueuedにリセット（public_idで検索）
export async function resetSummaryToQueued(pool, publicId, userId) {
  await pool.query(
    `UPDATE summaries
     SET status='queued', error_code=NULL, error_message=NULL, started_at=NULL, finished_at=NULL, summary_text=NULL
     WHERE public_id=? AND user_id=?`,
    [publicId, userId]
  );
}

// 要約が存在するかチェック（public_idで検索）
export async function checkSummaryExists(pool, publicId, userId) {
  const [rows] = await pool.query(
    `SELECT id FROM summaries WHERE public_id=? AND user_id=?`,
    [publicId, userId]
  );
  return rows[0] ? true : false;
}

// 【後方互換】内部ID(id)で要約取得（Worker用）
export async function getSummaryById(pool, summaryId) {
  const [rows] = await pool.query(
    `SELECT id, public_id, user_id, range_start, range_end, status, template_id, summary_text FROM summaries WHERE id=?`,
    [summaryId]
  );
  return rows[0] || null;
}
