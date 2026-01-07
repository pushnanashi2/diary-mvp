/**
 * Audit Log Middleware
 * 監査ログ記録用ミドルウェア
 */

/**
 * 監査ログを記録
 */
export async function logAudit(pool, userId, action, resourceType, resourceId, req, details = {}) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    const sql = `
      INSERT INTO audit_logs
      (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await pool.query(sql, [
      userId || null,
      action,
      resourceType,
      resourceId || null,
      ipAddress,
      userAgent,
      JSON.stringify(details)
    ]);
  } catch (error) {
    // 監査ログのエラーはメイン処理を阻害しない
    console.error('[AUDIT_LOG] Error:', error.message);
  }
}

/**
 * 監査ログ一覧取得
 */
export async function getAuditLogs(pool, userId, filters = {}) {
  const { action, resource_type, start_date, end_date, limit = 100 } = filters;
  
  let sql = 'SELECT * FROM audit_logs WHERE user_id = ?';
  const params = [userId];
  
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  
  if (resource_type) {
    sql += ' AND resource_type = ?';
    params.push(resource_type);
  }
  
  if (start_date) {
    sql += ' AND created_at >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    sql += ' AND created_at <= ?';
    params.push(end_date);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const [rows] = await pool.query(sql, params);
  return rows;
}
