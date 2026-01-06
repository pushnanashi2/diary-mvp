/**
 * データベース接続の設定
 */

import mysql from 'mysql2/promise';
import { DB_CREDENTIALS } from './secrets.js';

export async function createDatabasePool() {
  if (!DB_CREDENTIALS) {
    throw new Error('Database credentials not found');
  }

  return await mysql.createPool({
    host: DB_CREDENTIALS.host,
    port: DB_CREDENTIALS.port || 3306,
    user: DB_CREDENTIALS.user,
    password: DB_CREDENTIALS.password,
    database: DB_CREDENTIALS.database,
    connectionLimit: 10,
  });
}

/**
 * カラムが存在しなければ追加
 */
export async function addColumnIfMissing(pool, table, column, alterSql) {
  const dbName = DB_CREDENTIALS.database;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema=? AND table_name=? AND column_name=?`,
    [dbName, table, column]
  );
  
  if (Number(rows[0]?.cnt || 0) === 0) {
    await pool.query(alterSql);
  }
}
