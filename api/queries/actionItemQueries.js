/**
 * アクションアイテム関連のSQLクエリ
 */

/**
 * ユーザーのアクションアイテム一覧を取得
 */
export async function listActionItems(pool, userId, status = null, limit = 100) {
  let sql = `
    SELECT 
      ai.id,
      ai.public_id,
      ai.title,
      ai.description,
      ai.priority,
      ai.status,
      ai.due_date,
      ai.completed_at,
      ai.created_at,
      ai.updated_at,
      e.public_id as entry_public_id,
      e.title as entry_title
    FROM action_items ai
    LEFT JOIN entries e ON ai.entry_id = e.id
    WHERE ai.user_id = ?
  `;
  
  const params = [userId];
  
  if (status) {
    sql += ' AND ai.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY ai.due_date ASC, ai.priority DESC, ai.created_at DESC LIMIT ?';
  params.push(limit);
  
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * 特定のアクションアイテムを取得
 */
export async function getActionItemByPublicId(pool, publicId, userId) {
  const sql = `
    SELECT 
      ai.*,
      e.public_id as entry_public_id,
      e.title as entry_title
    FROM action_items ai
    LEFT JOIN entries e ON ai.entry_id = e.id
    WHERE ai.public_id = ? AND ai.user_id = ?
  `;
  
  const [rows] = await pool.query(sql, [publicId, userId]);
  return rows[0] || null;
}

/**
 * エントリーのアクションアイテム一覧を取得
 */
export async function getActionItemsByEntry(pool, entryId, userId) {
  const sql = `
    SELECT *
    FROM action_items
    WHERE entry_id = ? AND user_id = ?
    ORDER BY priority DESC, due_date ASC
  `;
  
  const [rows] = await pool.query(sql, [entryId, userId]);
  return rows;
}

/**
 * アクションアイテムを更新
 */
export async function updateActionItem(pool, publicId, userId, updates) {
  const allowedFields = ['title', 'description', 'priority', 'status', 'due_date'];
  const setClauses = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  // completed_at の自動設定
  if (updates.status === 'completed') {
    setClauses.push('completed_at = NOW()');
  } else if (updates.status && updates.status !== 'completed') {
    setClauses.push('completed_at = NULL');
  }
  
  if (setClauses.length === 0) {
    return false;
  }
  
  values.push(publicId, userId);
  
  const sql = `
    UPDATE action_items
    SET ${setClauses.join(', ')}
    WHERE public_id = ? AND user_id = ?
  `;
  
  const [result] = await pool.query(sql, values);
  return result.affectedRows > 0;
}

/**
 * アクションアイテムを削除
 */
export async function deleteActionItem(pool, publicId, userId) {
  const sql = 'DELETE FROM action_items WHERE public_id = ? AND user_id = ?';
  const [result] = await pool.query(sql, [publicId, userId]);
  return result.affectedRows > 0;
}

/**
 * 期限切れのアクションアイテムを取得
 */
export async function getOverdueActionItems(pool, userId) {
  const sql = `
    SELECT *
    FROM action_items
    WHERE user_id = ?
      AND status NOT IN ('completed', 'cancelled')
      AND due_date < CURDATE()
    ORDER BY due_date ASC
  `;
  
  const [rows] = await pool.query(sql, [userId]);
  return rows;
}
