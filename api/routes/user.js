/**
 * User Router
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateUpdateTemplate } from '../middleware/validation.js';
import { StorageService } from '../services/storageService.js';
import { logger } from '../utils/logger.js';
import * as userQueries from '../queries/userQueries.js';
import * as entryQueries from '../queries/entryQueries.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const user = await userQueries.getUserById(req.context.pool, req.user.id);
    if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND' } });
    delete user.password_hash;
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

router.put('/default-summary-template', authenticateToken, validateUpdateTemplate, async (req, res, next) => {
  try {
    await userQueries.updateDefaultTemplate(req.context.pool, req.user.id, req.body.template_id);
    logger.info('Default template updated', { userId: req.user.id, templateId: req.body.template_id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/', authenticateToken, async (req, res, next) => {
  try {
    const entries = await entryQueries.getEntriesByUserId(req.context.pool, req.user.id);
    const storageService = new StorageService(req.context.minio, req.context.s3Bucket);
    
    for (const entry of entries) {
      try {
        await storageService.deleteAudio(entry.audio_url);
      } catch (err) {
        logger.error('Failed to delete audio', { userId: req.user.id, entryId: entry.id, error: err.message });
      }
    }
    
    await userQueries.deleteUser(req.context.pool, req.user.id);
    logger.info('User deleted', { userId: req.user.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;