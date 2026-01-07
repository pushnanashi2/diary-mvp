/**
 * Reports Router
 * 定期レポートAPI
 */

import express from 'express';
import { ulid } from 'ulid';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /reports/schedule
 * 定期レポートを設定
 */
router.post('/schedule',
  authenticateToken,
  rateLimitMiddleware('reports', 10),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { name, frequency, day_of_week, day_of_month, time_of_day, report_type, delivery_method } = req.body;
      
      if (!name || !frequency) {
        throw new ApiError('MISSING_FIELDS', 'name and frequency are required', 400);
      }
      
      const publicId = ulid();
      
      const sql = `
        INSERT INTO scheduled_reports
        (user_id, public_id, name, frequency, day_of_week, day_of_month, time_of_day, report_type, delivery_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await req.context.pool.query(sql, [
        userId,
        publicId,
        name,
        frequency,
        day_of_week || null,
        day_of_month || null,
        time_of_day || '09:00:00',
        report_type || 'summary',
        delivery_method || 'email'
      ]);
      
      res.status(201).json({
        public_id: publicId,
        name,
        frequency,
        is_active: true
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /reports/scheduled
 * 定期レポート一覧
 */
router.get('/scheduled',
  authenticateToken,
  rateLimitMiddleware('reports', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      const [rows] = await req.context.pool.query(
        'SELECT * FROM scheduled_reports WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      
      res.json({ reports: rows });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /reports/scheduled/:public_id
 * 定期レポートを削除
 */
router.delete('/scheduled/:public_id',
  authenticateToken,
  rateLimitMiddleware('reports', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      
      const [result] = await req.context.pool.query(
        'UPDATE scheduled_reports SET is_active = 0 WHERE public_id = ? AND user_id = ?',
        [public_id, userId]
      );
      
      if (result.affectedRows === 0) {
        throw new ApiError('REPORT_NOT_FOUND', 'Scheduled report not found', 404);
      }
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
