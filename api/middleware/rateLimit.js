/**
 * レート制限ミドルウェア
 * Redisを使用してユーザーごとのリクエスト数を制限
 */
import { ApiError } from './errorHandler.js';

/**
 * レート制限チェック関数
 */
export async function checkRateLimit(redis, endpoint, userId, limitPerWindow = 30, windowSec = 60) {
  const key = `rate_limit:${userId}:${endpoint}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  
  return count <= limitPerWindow;
}

/**
 * レート制限ミドルウェアファクトリー
 */
export function rateLimitMiddleware(endpoint, limitPerWindow, windowSec = 60) {
  return async (req, res, next) => {
    try {
      const allowed = await checkRateLimit(
        req.redis,
        endpoint,
        req.userId,
        limitPerWindow,
        windowSec
      );
      
      if (!allowed) {
        throw new ApiError(
          429,
          'RATE_LIMIT_EXCEEDED',
          `Too many requests. Limit: ${limitPerWindow} per ${windowSec} seconds`
        );
      }
      
      next();
    } catch (err) {
      next(err);
    }
  };
}
