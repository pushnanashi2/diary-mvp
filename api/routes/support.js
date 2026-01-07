/**
 * Support Chat Router
 * ユーザー問い合わせチャットボット API
 */

import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getPool } from '../config/database.js';
import { ulid } from 'ulid';

const router = express.Router();

/**
 * POST /support/conversations
 * 新しいサポート会話を開始
 * 認証オプション（未ログインユーザーも可能）
 */
router.post('/conversations', optionalAuth, async (req, res, next) => {
  try {
    const { message, email, category } = req.body;
    const pool = getPool();

    if (!message) {
      return res.status(400).json({
        error: { code: 'MISSING_MESSAGE', message: 'Message is required' },
      });
    }

    // 未ログインユーザーの場合はメールアドレス必須
    if (!req.user && !email) {
      return res.status(400).json({
        error: { code: 'MISSING_EMAIL', message: 'Email is required for guest users' },
      });
    }

    const publicId = ulid();
    const sessionId = req.sessionID || ulid();
    const userId = req.user?.id || null;

    // 会話を作成
    const [result] = await pool.query(
      `INSERT INTO support_conversations 
       (public_id, user_id, session_id, email, category, first_message, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [publicId, userId, sessionId, email || req.user?.email, category || 'general', message]
    );

    const conversationId = result.insertId;

    // 最初のメッセージを保存
    await pool.query(
      `INSERT INTO support_messages 
       (conversation_id, sender_type, sender_id, message)
       VALUES (?, 'user', ?, ?)`,
      [conversationId, userId, message]
    );

    // AI ボットの自動応答を生成（簡易版）
    const botResponse = await generateBotResponse(message, category);

    await pool.query(
      `INSERT INTO support_messages 
       (conversation_id, sender_type, message, is_ai_generated, ai_confidence)
       VALUES (?, 'bot', ?, TRUE, ?)`,
      [conversationId, botResponse.message, botResponse.confidence]
    );

    // 高優先度の場合は管理者に通知
    if (category === 'urgent') {
      await notifyAdmins(conversationId, 'high_priority');
    }

    logger.info('Support conversation created', {
      conversationId,
      publicId,
      userId,
      category,
    });

    res.status(201).json({
      conversation: {
        public_id: publicId,
        status: 'open',
        category: category || 'general',
      },
      bot_response: botResponse.message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /support/conversations/:public_id
 * サポート会話の詳細を取得
 */
router.get('/conversations/:public_id', optionalAuth, async (req, res, next) => {
  try {
    const { public_id } = req.params;
    const pool = getPool();

    // 会話を取得
    const [conversations] = await pool.query(
      `SELECT * FROM support_conversations WHERE public_id = ?`,
      [public_id]
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const conversation = conversations[0];

    // 権限チェック（自分の会話またはセッションIDが一致する場合のみ）
    if (
      req.user &&
      conversation.user_id !== req.user.id &&
      conversation.session_id !== req.sessionID
    ) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    }

    // メッセージを取得
    const [messages] = await pool.query(
      `SELECT id, sender_type, message, is_ai_generated, created_at
       FROM support_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [conversation.id]
    );

    res.json({
      conversation: {
        public_id: conversation.public_id,
        status: conversation.status,
        category: conversation.category,
        created_at: conversation.created_at,
        resolved_at: conversation.resolved_at,
      },
      messages,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /support/conversations/:public_id/messages
 * 会話にメッセージを追加
 */
router.post('/conversations/:public_id/messages', optionalAuth, async (req, res, next) => {
  try {
    const { public_id } = req.params;
    const { message } = req.body;
    const pool = getPool();

    if (!message) {
      return res.status(400).json({
        error: { code: 'MISSING_MESSAGE', message: 'Message is required' },
      });
    }

    // 会話を取得
    const [conversations] = await pool.query(
      `SELECT * FROM support_conversations WHERE public_id = ?`,
      [public_id]
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const conversation = conversations[0];

    // ユーザーメッセージを保存
    await pool.query(
      `INSERT INTO support_messages 
       (conversation_id, sender_type, sender_id, message)
       VALUES (?, 'user', ?, ?)`,
      [conversation.id, req.user?.id, message]
    );

    // ボットの応答を生成
    const botResponse = await generateBotResponse(message, conversation.category);

    await pool.query(
      `INSERT INTO support_messages 
       (conversation_id, sender_type, message, is_ai_generated, ai_confidence)
       VALUES (?, 'bot', ?, TRUE, ?)`,
      [conversation.id, botResponse.message, botResponse.confidence]
    );

    // 会話を更新
    await pool.query(
      `UPDATE support_conversations SET updated_at = NOW() WHERE id = ?`,
      [conversation.id]
    );

    res.json({
      user_message: message,
      bot_response: botResponse.message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /support/conversations/:public_id/resolve
 * 会話を解決済みにする
 */
router.post('/conversations/:public_id/resolve', optionalAuth, async (req, res, next) => {
  try {
    const { public_id } = req.params;
    const { rating } = req.body; // 1-5
    const pool = getPool();

    const [conversations] = await pool.query(
      `SELECT * FROM support_conversations WHERE public_id = ?`,
      [public_id]
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const conversation = conversations[0];

    await pool.query(
      `UPDATE support_conversations 
       SET status = 'resolved', resolved_at = NOW()
       WHERE id = ?`,
      [conversation.id]
    );

    // 統計を更新
    if (rating) {
      await updateSupportStats(conversation.id, rating);
    }

    res.json({
      message: 'Conversation resolved',
      public_id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ボットの応答を生成（簡易版）
 * 本番環境では OpenAI API を使用
 */
async function generateBotResponse(message, category) {
  // TODO: OpenAI API を統合
  const responses = {
    technical: {
      message: 'ご質問ありがとうございます。技術的な問題についてサポートいたします。具体的にどのような問題が発生していますか？',
      confidence: 0.8,
    },
    billing: {
      message: 'お支払いに関するお問い合わせですね。詳細を教えていただけますか？',
      confidence: 0.8,
    },
    general: {
      message: 'お問い合わせありがとうございます。どのようなご用件でしょうか？',
      confidence: 0.7,
    },
  };

  return responses[category] || responses.general;
}

/**
 * 管理者に通知
 */
async function notifyAdmins(conversationId, notificationType) {
  const pool = getPool();

  // アクティブな管理者を取得
  const [admins] = await pool.query(
    `SELECT id FROM admins WHERE is_active = TRUE AND role IN ('support', 'manager', 'admin')`
  );

  // 通知を作成
  for (const admin of admins) {
    await pool.query(
      `INSERT INTO admin_notifications 
       (admin_id, notification_type, conversation_id, message)
       VALUES (?, ?, ?, ?)`,
      [
        admin.id,
        notificationType,
        conversationId,
        '新しい高優先度のサポートリクエストが届きました',
      ]
    );
  }

  logger.info('Admin notifications sent', { conversationId, notificationType });
}

/**
 * サポート統計を更新
 */
async function updateSupportStats(conversationId, rating) {
  const pool = getPool();
  const today = new Date().toISOString().split('T')[0];

  await pool.query(
    `INSERT INTO support_stats (date, total_conversations, resolved_conversations, user_satisfaction_avg)
     VALUES (?, 1, 1, ?)
     ON DUPLICATE KEY UPDATE 
       resolved_conversations = resolved_conversations + 1,
       user_satisfaction_avg = (user_satisfaction_avg * (resolved_conversations - 1) + ?) / resolved_conversations`,
    [today, rating, rating]
  );
}

export default router;
