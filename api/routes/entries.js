/**
 * Entries Router
 */

import express from 'express';
import { ulid } from 'ulid';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { upload } from '../config/multer.js';
import { validateAudioUpload } from '../middleware/validation.js';
import { StorageService } from '../services/storageService.js';
import { TitleGenerator } from '../services/titleGenerator.js';
import { JobQueue } from '../services/jobQueue.js';
import logger from '../utils/logger.js';
import * as entryQueries from '../queries/entryQueries.js';

const router = express.Router();

router.post('/', 
  authenticateToken,
  rateLimitMiddleware('entries', 10),
  upload.single('audio'),
  validateAudioUpload,
  async (req, res, next) => {
    const { pool, redis, minio, s3Bucket } = req.context;
    const userId = req.user.id;
    
    try {
      const storageService = new StorageService(minio, s3Bucket);
      const { key, url } = await storageService.uploadAudio(userId, req.file.originalname, req.file.buffer);
      
      const titleGenerator = new TitleGenerator(pool);
      const title = await titleGenerator.generateTitle(userId);
      
      const publicId = ulid();
      const entryId = await entryQueries.createEntry(pool, {
        userId, title, publicId, audioUrl: url, status: 'processing'
      });
      
      const jobQueue = new JobQueue(redis);
      await jobQueue.enqueueEntryProcessing(entryId);
      
      logger.info('Entry created', { userId, entryId, publicId, title });
      res.status(201).json({ success: true, entry: { id: entryId, public_id: publicId, title, status: 'processing' } });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const entries = await entryQueries.getEntriesByUserId(req.context.pool, req.user.id);
    res.json({ success: true, entries });
  } catch (error) {
    next(error);
  }
});

router.get('/:public_id', authenticateToken, async (req, res, next) => {
  try {
    const entry = await entryQueries.getEntryByPublicId(req.context.pool, req.params.public_id);
    if (!entry) return res.status(404).json({ error: { code: 'ENTRY_NOT_FOUND', message: 'Entry not found' } });
    if (entry.user_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    res.json({ success: true, entry });
  } catch (error) {
    next(error);
  }
});

router.get('/:public_id/audio', authenticateToken, async (req, res, next) => {
  try {
    const entry = await entryQueries.getEntryByPublicId(req.context.pool, req.params.public_id);
    if (!entry || entry.user_id !== req.user.id) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    const storageService = new StorageService(req.context.minio, req.context.s3Bucket);
    await storageService.streamAudio(entry.audio_url, res);
  } catch (error) {
    next(error);
  }
});

router.delete('/:public_id', authenticateToken, async (req, res, next) => {
  try {
    const entry = await entryQueries.getEntryByPublicId(req.context.pool, req.params.public_id);
    if (!entry || entry.user_id !== req.user.id) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    
    const storageService = new StorageService(req.context.minio, req.context.s3Bucket);
    await storageService.deleteAudio(entry.audio_url);
    await entryQueries.deleteEntry(req.context.pool, entry.id);
    
    logger.info('Entry deleted', { userId: req.user.id, publicId: req.params.public_id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;