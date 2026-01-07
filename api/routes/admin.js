/**
 * Admin Dashboard Router
 * 管理者用サポート管理 API
 */

import express from 'express';
import { logger } from '../utils/logger.js';
import { getPool } from '../config/database.js';

const router = express.Router();

/**
 * 管理者認証ミドルウェア
 * TODO: 本番環境では JWT 認証を実装
 */
const authenticateAdmin = (req, res, next) => {
  // 仮実装：ヘッダーから管理者IDを取得
  const adminId = req.headers['x-admin-id'];

  if (!adminId) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' },
    });
  }

  req.admin = { id: parseInt(adminId) };
  next();
};

/**
 * GET /admin/conversations
 * サポート会話一覧を取得
 */
router.get('/conversations', authenticateAdmin, async (req, res, next) => {
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
        sc.priority,
        sc.category,
        sc.first_message,
        sc.created_at,
        sc.updated_at,
        sc.assigned_admin_id,
        (SELECT COUNT(*) FROM support_messages WHERE conversation_id = sc.id) as message_count
      FROM support_conversations sc
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ` AND sc.status = ?`;
      params.push(status);
    }

    if (priority) {
      query += ` AND sc.priority = ?`;
      params.push(priority);
    }

    query += ` ORDER BY sc.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const [conversations] = await pool.query(query, params);

    // 総数を取得
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM support_conversations WHERE 1=1 ${status ? 'AND status = ?' : ''} ${priority ? 'AND priority = ?' : ''}`,
      params.filter((_, i) => i < params.length - 2)
    );

    res.json({
      conversations,
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
 * GET /admin/conversations/:id
 * サポート会話の詳細を取得
 */
router.get('/conversations/:id', authenticateAdmin, async (req, res, next) => {
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

    // フィードバックを取得
    const [feedback] = await pool.query(
      `SELECT * FROM admin_feedback WHERE conversation_id = ? ORDER BY created_at DESC`,
      [conversation.id]
    );

    res.json({
      conversation,
      messages,
      feedback,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/conversations/:id/messages
 * 管理者がメッセージを送信
 */
router.post('/conversations/:id/messages', authenticateAdmin, async (req, res, next) => {
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
      [conversation.id, req.admin.id, message]
    );

    // 会話のステータスを更新
    await pool.query(
      `UPDATE support_conversations 
       SET status = 'waiting', updated_at = NOW(), assigned_admin_id = ?
       WHERE id = ?`,
      [req.admin.id, conversation.id]
    );

    logger.info('Admin message sent', {
      conversationId: conversation.id,
      adminId: req.admin.id,
    });

    res.json({
      message: 'Message sent successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /admin/conversations/:id/assign
 * 会話を管理者に割り当て
 */
router.put('/conversations/:id/assign', authenticateAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { admin_id } = req.body;
    const pool = getPool();

    await pool.query(
      `UPDATE support_conversations SET assigned_admin_id = ? WHERE id = ? OR public_id = ?`,
      [admin_id || req.admin.id, id, id]
    );

    res.json({
      message: 'Conversation assigned successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /admin/conversations/:id/status
 * 会話のステータスを更新
 */
router.put('/conversations/:id/status', authenticateAdmin, async (req, res, next) => {
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
 * POST /admin/conversations/:id/feedback
 * 管理者フィードバックを追加
 */
router.post('/conversations/:id/feedback', authenticateAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { feedback_type, rating, notes, action_taken } = req.body;
    const pool = getPool();

    // 会話を取得
    const [conversations] = await pool.query(
      `SELECT id FROM support_conversations WHERE id = ? OR public_id = ?`,
      [id, id]
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    await pool.query(
      `INSERT INTO admin_feedback 
       (conversation_id, admin_id, feedback_type, rating, notes, action_taken)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversations[0].id, req.admin.id, feedback_type, rating, notes, action_taken]
    );

    res.json({
      message: 'Feedback added successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/stats
 * サポート統計を取得
 */
router.get('/stats', authenticateAdmin, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const pool = getPool();

    // 基本統計
    const [basicStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_conversations,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent_count,
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
 * GET /admin/notifications
 * 管理者通知を取得
 */
router.get('/notifications', authenticateAdmin, async (req, res, next) => {
  try {
    const { is_read } = req.query;
    const pool = getPool();

    let query = `
      SELECT * FROM admin_notifications 
      WHERE admin_id = ?
    `;
    const params = [req.admin.id];

    if (is_read !== undefined) {
      query += ` AND is_read = ?`;
      params.push(is_read === 'true' ? 1 : 0);
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const [notifications] = await pool.query(query, params);

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /admin/notifications/:id/read
 * 通知を既読にする
 */
router.put('/notifications/:id/read', authenticateAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    await pool.query(
      `UPDATE admin_notifications SET is_read = TRUE WHERE id = ? AND admin_id = ?`,
      [id, req.admin.id]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

export default router;
