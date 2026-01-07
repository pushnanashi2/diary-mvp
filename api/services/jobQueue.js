/**
 * JobQueue Service
 * Redis ジョブキュー投入の抽象化
 */

import logger from '../utils/logger.js';

export class JobQueue {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async enqueue(queueName, payload) {
    try {
      const jobData = JSON.stringify(payload);
      await this.redis.lPush(queueName, jobData);
      logger.info('Job enqueued', { queue: queueName, payload });
      return { success: true };
    } catch (error) {
      logger.error('Failed to enqueue job', { queue: queueName, error: error.message });
      throw error;
    }
  }

  async enqueueEntryProcessing(entryId) {
    return this.enqueue('PROCESS_ENTRY', { entry_id: entryId });
  }

  async enqueueSummaryProcessing(summaryId) {
    return this.enqueue('PROCESS_RANGE_SUMMARY', { summary_id: summaryId });
  }

  async enqueueRetrySummary(summaryId) {
    return this.enqueue('RETRY_RANGE_SUMMARY', { summary_id: summaryId });
  }
}

export default JobQueue;