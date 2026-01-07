/**
 * Action Items Router
 * アクションアイテム管理API
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import * as actionItemQueries from '../queries/actionItemQueries.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /action-items
 * アクションアイテム一覧取得
 */
router.get('/',
  authenticateToken,
  rateLimitMiddleware('action-items', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { status, limit } = req.query;
      
      const items = await actionItemQueries.listActionItems(
        req.context.pool,
        userId,
        status || null,
        limit ? parseInt(limit) : 100
      );
      
      res.json({ action_items: items });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /action-items/overdue
 * 期限切れのアクションアイテムを取得
 */
router.get('/overdue',
  authenticateToken,
  rateLimitMiddleware('action-items', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const items = await actionItemQueries.getOverdueActionItems(req.context.pool, userId);
      
      res.json({ action_items: items });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /action-items/:public_id
 * 特定のアクションアイテムを取得
 */
router.get('/:public_id',
  authenticateToken,
  rateLimitMiddleware('action-items', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      
      const item = await actionItemQueries.getActionItemByPublicId(
        req.context.pool,
        public_id,
        userId
      );
      
      if (!item) {
        throw new ApiError('ACTION_ITEM_NOT_FOUND', 'Action item not found', 404);
      }
      
      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /action-items/:public_id
 * アクションアイテムを更新
 */
router.patch('/:public_id',
  authenticateToken,
  rateLimitMiddleware('action-items', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      const updates = req.body;
      
      // バリデーション
      const allowedFields = ['title', 'description', 'priority', 'status', 'due_date'];
      const hasValidField = Object.keys(updates).some(key => allowedFields.includes(key));
      
      if (!hasValidField) {
        throw new ApiError('INVALID_UPDATE', 'No valid fields to update', 400);
      }
      
      // priority のバリデーション
      if (updates.priority && !['low', 'medium', 'high', 'urgent'].includes(updates.priority)) {
        throw new ApiError('INVALID_PRIORITY', 'Invalid priority value', 400);
      }
      
      // status のバリデーション
      if (updates.status && !['pending', 'in_progress', 'completed', 'cancelled'].includes(updates.status)) {
        throw new ApiError('INVALID_STATUS', 'Invalid status value', 400);
      }
      
      const success = await actionItemQueries.updateActionItem(
        req.context.pool,
        public_id,
        userId,
        updates
      );
      
      if (!success) {
        throw new ApiError('ACTION_ITEM_NOT_FOUND', 'Action item not found', 404);
      }
      
      // 更新後のデータを取得
      const updatedItem = await actionItemQueries.getActionItemByPublicId(
        req.context.pool,
        public_id,
        userId
      );
      
      res.json(updatedItem);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /action-items/:public_id
 * アクションアイテムを削除
 */
router.delete('/:public_id',
  authenticateToken,
  rateLimitMiddleware('action-items', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      
      const success = await actionItemQueries.deleteActionItem(
        req.context.pool,
        public_id,
        userId
      );
      
      if (!success) {
        throw new ApiError('ACTION_ITEM_NOT_FOUND', 'Action item not found', 404);
      }
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
