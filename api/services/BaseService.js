/**
 * Base Service Class
 * すべてのサービスの基底クラス
 */

import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';

export class BaseService {
  constructor(pool, redis = null) {
    this.pool = pool;
    this.redis = redis;
  }

  /**
   * トランザクション実行ヘルパー
   */
  async withTransaction(callback) {
    const connection = await this.pool.getConnection();
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

  /**
   * キャッシュ取得ヘルパー
   */
  async getFromCache(key, defaultValue = null) {
    if (!this.redis) return defaultValue;

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      logger.error(`Cache get error for ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * キャッシュ設定ヘルパー
   */
  async setCache(key, value, ttl = 3600) {
    if (!this.redis) return;

    try {
      await this.redis.set(key, JSON.stringify(value), { EX: ttl });
    } catch (error) {
      logger.error(`Cache set error for ${key}:`, error);
    }
  }

  /**
   * キャッシュ削除ヘルパー
   */
  async deleteCache(key) {
    if (!this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error(`Cache delete error for ${key}:`, error);
    }
  }

  /**
   * エラーハンドリング
   */
  handleError(error, context = '') {
    logger.error(`[${this.constructor.name}] ${context}:`, error);
    
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      'SERVICE_ERROR',
      `Service error: ${error.message}`,
      500
    );
  }
}
