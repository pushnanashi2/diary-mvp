/**
 * Reminders Router
 * リマインダーAPI
 */

import express from 'express';
import { ulid } from 'ulid';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /reminders
 * リマインダーを作成
 */
router.post('/',
  authenticateToken,
  rateLimitMiddleware('reminders', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { title, description, reminder_time, notification_type, action_item_id, entry_id } = req.body;
      
      if (!title || !reminder_time) {
        throw new ApiError('MISSING_FIELDS', 'title and reminder_time are required', 400);
      }
      
      const publicId = ulid();
      
      const sql = `
        INSERT INTO reminders
        (user_id, action_item_id, entry_id, public_id, title, description, reminder_time, notification_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const [result] = await req.context.pool.query(sql, [
        userId,
        action_item_id || null,
        entry_id || null,
        publicId,
        title,
        description || null,
        reminder_time,
        notification_type || 'email'
      ]);
      
      res.status(201).json({
        id: result.insertId,
        public_id: publicId,
        title,
        reminder_time,
        notification_type: notification_type || 'email',
        status: 'pending'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /reminders
 * リマインダー一覧取得
 */
router.get('/',
  authenticateToken,
  rateLimitMiddleware('reminders', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { status, limit = 100 } = req.query;
      
      let sql = `
        SELECT 
          r.*,
          ai.title as action_item_title,
          e.title as entry_title
        FROM reminders r
        LEFT JOIN action_items ai ON r.action_item_id = ai.id
        LEFT JOIN entries e ON r.entry_id = e.id
        WHERE r.user_id = ?
      `;
      
      const params = [userId];
      
      if (status) {
        sql += ' AND r.status = ?';
        params.push(status);
      }
      
      sql += ' ORDER BY r.reminder_time ASC LIMIT ?';
      params.push(parseInt(limit));
      
      const [rows] = await req.context.pool.query(sql, params);
      
      res.json({ reminders: rows });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /reminders/:public_id
 * リマインダーを削除
 */
router.delete('/:public_id',
  authenticateToken,
  rateLimitMiddleware('reminders', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      
      const [result] = await req.context.pool.query(
        'UPDATE reminders SET status = \'cancelled\' WHERE public_id = ? AND user_id = ?',
        [public_id, userId]
      );
      
      if (result.affectedRows === 0) {
        throw new ApiError('REMINDER_NOT_FOUND', 'Reminder not found', 404);
      }
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
