/**
 * Admin Dashboard Router
 * 管理者用サポート管理 API
 */

import express from 'express';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getPool } from '../config/database.js';

const router = express.Router();

// すべてのルートに認証ミドルウェアを適用
router.use(authenticateToken);
router.use(isAdmin);

/**
 * GET /support/threads
 * サポート会話一覧を取得
 */
router.get('/support/threads', async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const pool = getPool();

    let query = `
      SELECT 
        sc.id,
        sc.public_id,
        sc.user_id,
        sc.email,
        sc.status,
        sc.category,
        sc.first_message,
        sc.created_at,
        sc.updated_at,
        (SELECT COUNT(*) FROM support_messages WHERE conversation_id = sc.id) as message_count
      FROM support_conversations sc
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ` AND sc.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY sc.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const [conversations] = await pool.query(query, params);

    // 総数を取得
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM support_conversations WHERE 1=1 ${status ? 'AND status = ?' : ''}`,
      params.filter((_, i) => i < params.length - 2)
    );

    res.json({
      threads: conversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /support/threads/:id
 * サポート会話の詳細を取得
 */
router.get('/support/threads/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // 会話を取得
    const [conversations] = await pool.query(
      `SELECT * FROM support_conversations WHERE id = ? OR public_id = ?`,
      [id, id]
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const conversation = conversations[0];

    // メッセージを取得
    const [messages] = await pool.query(
      `SELECT * FROM support_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      [conversation.id]
    );

    res.json({
      conversation,
      messages,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /support/threads/:id/reply
 * 管理者がメッセージを送信
 */
router.post('/support/threads/:id/reply', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const pool = getPool();

    if (!message) {
      return res.status(400).json({
        error: { code: 'MISSING_MESSAGE', message: 'Message is required' },
      });
    }

    // 会話を取得
    const [conversations] = await pool.query(
      `SELECT * FROM support_conversations WHERE id = ? OR public_id = ?`,
      [id, id]
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const conversation = conversations[0];

    // メッセージを保存
    await pool.query(
      `INSERT INTO support_messages 
       (conversation_id, sender_type, sender_id, message)
       VALUES (?, 'admin', ?, ?)`,
      [conversation.id, req.adminId, message]
    );

    // 会話を更新
    await pool.query(
      `UPDATE support_conversations 
       SET status = 'waiting', updated_at = NOW()
       WHERE id = ?`,
      [conversation.id]
    );

    logger.info('Admin message sent', {
      conversationId: conversation.id,
      adminId: req.adminId,
    });

    res.json({
      message: 'Message sent successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /support/threads/:id/status
 * 会話のステータスを更新
 */
router.put('/support/threads/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const pool = getPool();

    if (!['open', 'waiting', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({
        error: { code: 'INVALID_STATUS', message: 'Invalid status value' },
      });
    }

    const updateFields = ['status = ?', 'updated_at = NOW()'];
    const params = [status];

    if (status === 'resolved' || status === 'closed') {
      updateFields.push('resolved_at = NOW()');
    }

    await pool.query(
      `UPDATE support_conversations SET ${updateFields.join(', ')} WHERE id = ? OR public_id = ?`,
      [...params, id, id]
    );

    res.json({
      message: 'Status updated successfully',
      status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /support/stats
 * サポート統計を取得
 */
router.get('/support/stats', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const pool = getPool();

    // 基本統計
    const [basicStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_conversations,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
        AVG(TIMESTAMPDIFF(SECOND, created_at, resolved_at)) as avg_resolution_time
      FROM support_conversations
      WHERE created_at >= ? AND created_at <= ?
    `, [start_date || '2026-01-01', end_date || '2026-12-31']);

    // 日別統計
    const [dailyStats] = await pool.query(`
      SELECT date, total_conversations, resolved_conversations, 
             avg_response_time_seconds, user_satisfaction_avg
      FROM support_stats
      WHERE date >= ? AND date <= ?
      ORDER BY date DESC
      LIMIT 30
    `, [start_date || '2026-01-01', end_date || '2026-12-31']);

    res.json({
      basic_stats: basicStats[0],
      daily_stats: dailyStats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /support/export
 * CSVエクスポート
 */
router.post('/support/export', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.body;
    const pool = getPool();

    const [conversations] = await pool.query(`
      SELECT 
        sc.public_id,
        sc.email,
        sc.category,
        sc.status,
        sc.first_message,
        sc.created_at,
        sc.resolved_at,
        (SELECT COUNT(*) FROM support_messages WHERE conversation_id = sc.id) as message_count
      FROM support_conversations sc
      WHERE sc.created_at >= ? AND sc.created_at <= ?
      ORDER BY sc.created_at DESC
    `, [start_date || '2026-01-01', end_date || '2026-12-31']);

    res.json({
      data: conversations,
      message: 'Export data ready',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
