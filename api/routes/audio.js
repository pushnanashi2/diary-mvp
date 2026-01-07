/**
 * Audio Processing Router
 * Phase 4.3: 音声品質向上処理API
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { JobQueue } from '../services/jobQueue.js';
import logger from '../utils/logger.js';
import * as entryQueries from '../queries/entryQueries.js';

const router = express.Router();

/**
 * POST /audio/:public_id/denoise
 * ノイズ除去処理
 */
router.post('/:public_id/denoise', authenticateToken, rateLimitMiddleware('audio', 5), async (req, res, next) => {
  try {
    const entry = await entryQueries.getEntryByPublicId(req.context.pool, req.params.public_id);
    if (!entry || entry.user_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    
    const jobQueue = new JobQueue(req.context.redis);
    await jobQueue.enqueueAudioProcessing(entry.id, 'denoise');
    
    logger.info('Audio denoise requested', { userId: req.user.id, entryId: entry.id, publicId: req.params.public_id });
    
    res.json({
      success: true,
      message: 'Audio denoise processing started',
      entry: {
        public_id: req.params.public_id,
        status: 'processing'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /audio/:public_id/normalize
 * 音量正規化処理
 */
router.post('/:public_id/normalize', authenticateToken, rateLimitMiddleware('audio', 5), async (req, res, next) => {
  try {
    const entry = await entryQueries.getEntryByPublicId(req.context.pool, req.params.public_id);
    if (!entry || entry.user_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    
    const jobQueue = new JobQueue(req.context.redis);
    await jobQueue.enqueueAudioProcessing(entry.id, 'normalize');
    
    logger.info('Audio normalize requested', { userId: req.user.id, entryId: entry.id, publicId: req.params.public_id });
    
    res.json({
      success: true,
      message: 'Audio normalize processing started',
      entry: {
        public_id: req.params.public_id,
        status: 'processing'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /audio/:public_id/enhance
 * 音声エンハンス処理（ノイズ除去 + 正規化 + 圧縮）
 */
router.post('/:public_id/enhance', authenticateToken, rateLimitMiddleware('audio', 5), async (req, res, next) => {
  try {
    const entry = await entryQueries.getEntryByPublicId(req.context.pool, req.params.public_id);
    if (!entry || entry.user_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    
    const jobQueue = new JobQueue(req.context.redis);
    await jobQueue.enqueueAudioProcessing(entry.id, 'enhance');
    
    logger.info('Audio enhance requested', { userId: req.user.id, entryId: entry.id, publicId: req.params.public_id });
    
    res.json({
      success: true,
      message: 'Audio enhance processing started',
      entry: {
        public_id: req.params.public_id,
        status: 'processing'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
