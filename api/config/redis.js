/**
 * Redis Configuration
 * Redis接続管理の集約化
 */

import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

let redisClient = null;

/**
 * Redis接続を初期化
 */
export async function initializeRedis(url) {
  if (redisClient) {
    logger.warn('[REDIS] Client already initialized');
    return redisClient;
  }

  try {
    redisClient = createClient({
      url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('[REDIS] Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => logger.error('[REDIS] Client Error:', err));
    redisClient.on('connect', () => logger.info('[REDIS] Connected'));
    redisClient.on('reconnecting', () => logger.warn('[REDIS] Reconnecting...'));

    await redisClient.connect();
    logger.info('[REDIS] Client initialized successfully');
    return redisClient;
  } catch (error) {
    logger.error('[REDIS] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Redisクライアントを取得
 */
export function getRedis() {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis first.');
  }
  return redisClient;
}

/**
 * Redis接続を安全にクローズ
 */
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('[REDIS] Client closed');
  }
}

/**
 * Redisキャッシュヘルパー
 */
export async function cacheGet(key, defaultValue = null) {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (error) {
    logger.error(`[REDIS] Cache get error for key ${key}:`, error);
    return defaultValue;
  }
}

export async function cacheSet(key, value, ttl = 3600) {
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttl });
  } catch (error) {
    logger.error(`[REDIS] Cache set error for key ${key}:`, error);
  }
}

export async function cacheDel(key) {
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error(`[REDIS] Cache delete error for key ${key}:`, error);
  }
}
