/**
 * 日別カウンター関連のSQLクエリ（Phase2-1: #0問題修正版）
 */

/**
 * 日別カウンターをインクリメントして次の値を取得（原子的）
 * 
 * Phase2-1修正内容:
 * - #0が発生する問題を修正
 * - LAST_INSERT_ID()の使い方を修正
 * - ログ強化でデバッグ可能に
 * 
 * @param {mysql.Pool} pool - データベース接続プール
 * @param {number} userId - ユーザーID
 * @param {string} dateYmd - 日付（YYYY-MM-DD形式）
 * @returns {Promise<number>} カウンター値（1から開始）
 */
export async function incrementDailyCounter(pool, userId, dateYmd) {
  const conn = await pool.getConnection();
  try {
    // Step 1: トランザクション開始（排他ロック）
    await conn.beginTransaction();

    // Step 2: FOR UPDATE でロック取得
    const [rows] = await conn.query(
      `SELECT counter FROM daily_counters 
       WHERE user_id=? AND date_ymd=? 
       FOR UPDATE`,
      [userId, dateYmd]
    );

    let nextCounter;
    if (rows.length === 0) {
      // 初回: レコード作成
      await conn.query(
        `INSERT INTO daily_counters(user_id, date_ymd, counter) VALUES (?,?,1)`,
        [userId, dateYmd]
      );
      nextCounter = 1;
    } else {
      // 2回目以降: インクリメント
      const currentCounter = rows[0].counter;
      nextCounter = currentCounter + 1;
      await conn.query(
        `UPDATE daily_counters SET counter=? WHERE user_id=? AND date_ymd=?`,
        [nextCounter, userId, dateYmd]
      );
    }

    // Step 3: コミット
    await conn.commit();

    console.log(`[incrementDailyCounter] userId=${userId}, date=${dateYmd}, counter=${nextCounter}`);
    return nextCounter;
  } catch (error) {
    await conn.rollback();
    console.error('[incrementDailyCounter] Error:', error);
    console.error(`  userId=${userId}, dateYmd=${dateYmd}`);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * 【後方互換】旧関数名のエイリアス
 */
export async function getNextDailyCounter(pool, userId, dateYmd) {
  return incrementDailyCounter(pool, userId, dateYmd);
}
