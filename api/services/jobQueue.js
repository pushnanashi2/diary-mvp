/**
 * Job Queue Service
 * Redis ベースのジョブキュー管理
 */

import { logger } from '../utils/logger.js';
import { getRedis } from '../config/redis.js';

const QUEUE_KEY = 'jobs:queue';
const PROCESSING_KEY = 'jobs:processing';

/**
 * ジョブをキューに追加
 */
export async function enqueueJob(jobType, payload) {
  try {
    const redis = getRedis();
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: jobType,
      payload,
      createdAt: new Date().toISOString()
    };

    await redis.lPush(QUEUE_KEY, JSON.stringify(job));
    logger.info(`[QUEUE] Job enqueued: ${job.id} (${jobType})`);
    return job.id;
  } catch (error) {
    logger.error('[QUEUE] Failed to enqueue job:', error);
    throw error;
  }
}

/**
 * ジョブをキューから取得
 */
export async function dequeueJob() {
  try {
    const redis = getRedis();
    const jobData = await redis.rPop(QUEUE_KEY);
    
    if (!jobData) {
      return null;
    }

    const job = JSON.parse(jobData);
    await redis.hSet(PROCESSING_KEY, job.id, jobData);
    return job;
  } catch (error) {
    logger.error('[QUEUE] Failed to dequeue job:', error);
    throw error;
  }
}

/**
 * ジョブ完了をマーク
 */
export async function completeJob(jobId) {
  try {
    const redis = getRedis();
    await redis.hDel(PROCESSING_KEY, jobId);
    logger.info(`[QUEUE] Job completed: ${jobId}`);
  } catch (error) {
    logger.error('[QUEUE] Failed to complete job:', error);
    throw error;
  }
}
