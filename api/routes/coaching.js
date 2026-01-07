/**
 * Coaching Router
 * AIコーチング機能API
 */

import express from 'express';
import { ulid } from 'ulid';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /coaching/sessions
 * コーチングセッションを作成
 */
router.post('/sessions',
  authenticateToken,
  rateLimitMiddleware('coaching', 10),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { session_type, scheduled_at, notes } = req.body;
      
      if (!session_type) {
        throw new ApiError('MISSING_TYPE', 'session_type is required', 400);
      }
      
      const publicId = ulid();
      
      const [result] = await req.context.pool.query(
        'INSERT INTO coaching_sessions (user_id, public_id, session_type, scheduled_at, notes) VALUES (?, ?, ?, ?, ?)',
        [userId, publicId, session_type, scheduled_at || null, notes || null]
      );
      
      res.status(201).json({
        id: result.insertId,
        public_id: publicId,
        session_type,
        status: 'scheduled'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /coaching/sessions
 * コーチングセッション一覧
 */
router.get('/sessions',
  authenticateToken,
  rateLimitMiddleware('coaching', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { status } = req.query;
      
      let sql = 'SELECT * FROM coaching_sessions WHERE user_id = ?';
      const params = [userId];
      
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }
      
      sql += ' ORDER BY scheduled_at DESC, created_at DESC LIMIT 50';
      
      const [rows] = await req.context.pool.query(sql, params);
      
      res.json({ sessions: rows });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /coaching/sessions/:public_id
 * セッションを完了・更新
 */
router.patch('/sessions/:public_id',
  authenticateToken,
  rateLimitMiddleware('coaching', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      const { status, notes, insights } = req.body;
      
      const updates = [];
      const values = [];
      
      if (status) {
        updates.push('status = ?');
        values.push(status);
        
        if (status === 'completed') {
          updates.push('completed_at = NOW()');
        }
      }
      
      if (notes) {
        updates.push('notes = ?');
        values.push(notes);
      }
      
      if (insights) {
        updates.push('insights = ?');
        values.push(JSON.stringify(insights));
      }
      
      if (updates.length === 0) {
        throw new ApiError('NO_UPDATES', 'No fields to update', 400);
      }
      
      values.push(public_id, userId);
      
      const [result] = await req.context.pool.query(
        `UPDATE coaching_sessions SET ${updates.join(', ')} WHERE public_id = ? AND user_id = ?`,
        values
      );
      
      if (result.affectedRows === 0) {
        throw new ApiError('SESSION_NOT_FOUND', 'Coaching session not found', 404);
      }
      
      res.json({ message: 'Session updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
