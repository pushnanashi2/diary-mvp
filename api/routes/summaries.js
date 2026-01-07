/**
 * Summaries Router
 */

import express from 'express';
import { ulid } from 'ulid';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { validateSummaryCreate, validateSummaryRetry } from '../middleware/validation.js';
import { JobQueue } from '../services/jobQueue.js';
import logger from '../utils/logger.js';
import * as summaryQueries from '../queries/summaryQueries.js';
import * as userQueries from '../queries/userQueries.js';

const router = express.Router();

router.post('/', authenticateToken, rateLimitMiddleware('summaries', 10), validateSummaryCreate, async (req, res, next) => {
  const { pool, redis } = req.context;
  const { range_start, range_end, template_id } = req.body;
  
  try {
    let finalTemplateId = template_id;
    if (!finalTemplateId) {
      const user = await userQueries.getUserById(pool, req.user.id);
      finalTemplateId = user.default_summary_template;
    }
    
    const publicId = ulid();
    const summaryId = await summaryQueries.createSummary(pool, {
      userId: req.user.id, publicId, rangeStart: range_start, rangeEnd: range_end,
      templateId: finalTemplateId, status: 'processing'
    });
    
    const jobQueue = new JobQueue(redis);
    await jobQueue.enqueueSummaryProcessing(summaryId);
    
    logger.info('Summary created', { userId: req.user.id, summaryId, publicId });
    res.status(201).json({ success: true, summary: { id: summaryId, public_id: publicId, status: 'processing' } });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const summaries = await summaryQueries.getSummariesByUserId(req.context.pool, req.user.id);
    res.json({ success: true, summaries });
  } catch (error) {
    next(error);
  }
});

router.get('/:public_id', authenticateToken, async (req, res, next) => {
  try {
    const summary = await summaryQueries.getSummaryByPublicId(req.context.pool, req.params.public_id);
    if (!summary) return res.status(404).json({ error: { code: 'SUMMARY_NOT_FOUND' } });
    if (summary.user_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    res.json({ success: true, summary });
  } catch (error) {
    next(error);
  }
});

router.post('/:public_id/retry', authenticateToken, validateSummaryRetry, async (req, res, next) => {
  try {
    const summary = await summaryQueries.getSummaryByPublicId(req.context.pool, req.params.public_id);
    if (!summary || summary.user_id !== req.user.id) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    if (!['done', 'failed'].includes(summary.status)) return res.status(400).json({ error: { code: 'INVALID_STATUS' } });
    
    await summaryQueries.updateSummaryStatus(req.context.pool, summary.id, 'processing', null);
    const jobQueue = new JobQueue(req.context.redis);
    await jobQueue.enqueueRetrySummary(summary.id);
    
    logger.info('Summary retry requested', { userId: req.user.id, summaryId: summary.id });
    res.json({ success: true, summary: { id: summary.id, public_id: req.params.public_id, status: 'processing' } });
  } catch (error) {
    next(error);
  }
});

export default router;