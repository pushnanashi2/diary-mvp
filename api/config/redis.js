/**
 * Redis接続の設定
 */

import Redis from 'ioredis';
import { REDIS_URL } from './secrets.js';

export function createRedisClient() {
  if (!REDIS_URL) {
    throw new Error('REDIS_URL not configured');
  }
  
  return new Redis(REDIS_URL);
}
