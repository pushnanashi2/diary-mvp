/**
 * 日別カウンター関連のSQLクエリ
 */

// 日別カウンターの次の値を取得（原子的）
export async function getNextDailyCounter(pool, userId, dateYmd) {
  const conn = await pool.getConnection();
  try {
    // ON DUPLICATE KEY UPDATEで原子的にカウンターをインクリメント
    await conn.query(
      `INSERT INTO daily_counters(user_id, date_ymd, counter)
       VALUES (?,?,1)
       ON DUPLICATE KEY UPDATE counter = LAST_INSERT_ID(counter + 1)`,
      [userId, dateYmd]
    );
    
    const [[row]] = await conn.query(`SELECT LAST_INSERT_ID() AS n`);
    return Number(row.n);
  } finally {
    conn.release();
  }
}
