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
import * as entryQueries from '../queries/entryQueries.js';
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

// Phase 4.1: カスタム要約再生成
router.post('/:public_id/regenerate', authenticateToken, rateLimitMiddleware('summaries', 5), async (req, res, next) => {
  const { style, length, focus, custom_prompt } = req.body;
  
  // バリデーション
  const validStyles = ['bullet_points', 'narrative', 'concise', 'detailed'];
  const validLengths = ['short', 'medium', 'long'];
  const validFocus = ['action_items', 'key_points', 'emotions', 'events', 'insights'];
  
  if (style && !validStyles.includes(style)) {
    return res.status(400).json({ 
      error: { code: 'INVALID_STYLE', message: `style must be one of: ${validStyles.join(', ')}` } 
    });
  }
  
  if (length && !validLengths.includes(length)) {
    return res.status(400).json({ 
      error: { code: 'INVALID_LENGTH', message: `length must be one of: ${validLengths.join(', ')}` } 
    });
  }
  
  if (focus && !validFocus.includes(focus)) {
    return res.status(400).json({ 
      error: { code: 'INVALID_FOCUS', message: `focus must be one of: ${validFocus.join(', ')}` } 
    });
  }
  
  try {
    // summaryではなくentryに対する要約再生成
    const entry = await entryQueries.getEntryByPublicId(req.context.pool, req.params.public_id);
    if (!entry || entry.user_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
    
    if (!entry.transcript_text) {
      return res.status(400).json({ 
        error: { code: 'NO_TRANSCRIPT', message: 'Transcript not available yet' } 
      });
    }
    
    // カスタム要約パラメータをジョブキューに渡す
    const jobQueue = new JobQueue(req.context.redis);
    await jobQueue.enqueueCustomSummary(entry.id, {
      style: style || 'narrative',
      length: length || 'medium',
      focus: focus || 'key_points',
      custom_prompt
    });
    
    logger.info('Custom summary requested', { 
      userId: req.user.id, 
      entryId: entry.id,
      publicId: req.params.public_id,
      style, length, focus
    });
    
    res.json({ 
      success: true, 
      message: 'Custom summary generation started',
      entry: {
        public_id: req.params.public_id,
        status: 'regenerating'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
