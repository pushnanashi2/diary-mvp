/**
 * 要約関連のSQLクエリ
 */

// 要約作成
export async function createSummary(pool, userId, rangeStart, rangeEnd, templateId) {
  const [result] = await pool.query(
    `INSERT INTO summaries(user_id, range_start, range_end, status, template_id)
     VALUES (?,?,?, 'queued', ?)`,
    [userId, new Date(rangeStart), new Date(rangeEnd), templateId]
  );
  return result.insertId;
}

// 要約一覧取得
export async function listSummaries(pool, userId, status, limit, offset) {
  let sql = `SELECT id, range_start, range_end, status, template_id, error_code, started_at, finished_at, created_at
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

// 要約詳細取得
export async function getSummaryById(pool, summaryId, userId) {
  const [rows] = await pool.query(
    `SELECT id, range_start, range_end, status, template_id, summary_text, error_code, error_message, started_at, finished_at, created_at
     FROM summaries WHERE id=? AND user_id=?`,
    [summaryId, userId]
  );
  return rows[0] || null;
}

// 要約のステータスをqueuedにリセット
export async function resetSummaryToQueued(pool, summaryId, userId) {
  await pool.query(
    `UPDATE summaries
     SET status='queued', error_code=NULL, error_message=NULL, started_at=NULL, finished_at=NULL, summary_text=NULL
     WHERE id=? AND user_id=?`,
    [summaryId, userId]
  );
}

// 要約が存在するかチェック
export async function checkSummaryExists(pool, summaryId, userId) {
  const [rows] = await pool.query(
    `SELECT id FROM summaries WHERE id=? AND user_id=?`,
    [summaryId, userId]
  );
  return rows[0] ? true : false;
}
