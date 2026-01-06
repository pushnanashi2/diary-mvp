/**
 * レート制限ミドルウェア
 */

export async function rateLimit(redis, userId, key, limitPerMin) {
  const bucket = Math.floor(Date.now() / 60000);
  const redisKey = `rl:${userId}:${key}:${bucket}`;
  
  const count = await redis.incr(redisKey);
  
  if (count === 1) {
    await redis.expire(redisKey, 60);
  }
  
  return count <= limitPerMin;
}
