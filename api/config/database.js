/**
 * Database Configuration
 * MySQL接続プール管理の集約化
 */

import mysql from 'mysql2/promise';
import { logger } from '../utils/logger.js';

let pool = null;

/**
 * データベース接続プールを初期化
 */
export async function initializeDatabase(config) {
  if (pool) {
    logger.warn('[DATABASE] Pool already initialized');
    return pool;
  }

  try {
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: config.connectionLimit || 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    // 接続テスト
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    logger.info('[DATABASE] Connection pool initialized successfully');
    return pool;
  } catch (error) {
    logger.error('[DATABASE] Failed to initialize pool:', error);
    throw error;
  }
}

/**
 * データベース接続プールを取得
 */
export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase first.');
  }
  return pool;
}

/**
 * データベース接続を取得（プールから）
 * getPool()のエイリアス
 */
export function getConnection() {
  return getPool();
}

/**
 * データベース接続を安全にクローズ
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('[DATABASE] Connection pool closed');
  }
}

/**
 * トランザクションヘルパー
 */
export async function withTransaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
