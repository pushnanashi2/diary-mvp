/**
 * Test Setup
 * テスト環境の初期化
 */

import { initializeDatabase, closeDatabase } from '../config/database.js';
import { initializeRedis, closeRedis } from '../config/redis.js';

// テスト用データベース設定
const testDbConfig = {
  host: process.env.TEST_MYSQL_HOST || 'localhost',
  port: parseInt(process.env.TEST_MYSQL_PORT || '3306'),
  user: process.env.TEST_MYSQL_USER || 'root',
  password: process.env.TEST_MYSQL_PASSWORD || '',
  database: process.env.TEST_MYSQL_DB || 'diary_test_db',
  connectionLimit: 5
};

const testRedisUrl = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

// グローバルセットアップ
beforeAll(async () => {
  await initializeDatabase(testDbConfig);
  await initializeRedis(testRedisUrl);
});

// グローバルクリーンアップ
afterAll(async () => {
  await closeDatabase();
  await closeRedis();
});

export { testDbConfig, testRedisUrl };
