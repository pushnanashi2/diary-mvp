/**
 * Chat Router
 * AIチャットボットAPI (RAG対応)
 */

import express from 'express';
import { ulid } from 'ulid';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /chat/conversations
 * 新しい会話を開始
 */
router.post('/conversations',
  authenticateToken,
  rateLimitMiddleware('chat', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { title } = req.body;
      
      const publicId = ulid();
      
      const [result] = await req.context.pool.query(
        'INSERT INTO chat_conversations (user_id, public_id, title) VALUES (?, ?, ?)',
        [userId, publicId, title || '新しい会話']
      );
      
      res.status(201).json({
        id: result.insertId,
        public_id: publicId,
        title: title || '新しい会話'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /chat/conversations/:public_id/messages
 * メッセージを送信（AI応答を生成）
 */
router.post('/conversations/:public_id/messages',
  authenticateToken,
  rateLimitMiddleware('chat', 10),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      const { message } = req.body;
      
      if (!message) {
        throw new ApiError('MISSING_MESSAGE', 'Message is required', 400);
      }
      
      // 会話取得
      const [conversations] = await req.context.pool.query(
        'SELECT id FROM chat_conversations WHERE public_id = ? AND user_id = ?',
        [public_id, userId]
      );
      
      if (conversations.length === 0) {
        throw new ApiError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
      }
      
      const conversationId = conversations[0].id;
      
      // ユーザーメッセージを保存
      await req.context.pool.query(
        'INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, \'user\', ?)',
        [conversationId, message]
      );
      
      // 簡易的なAI応答（実際はOpenAI + RAGで実装）
      const aiResponse = `あなたの日記データを基にした回答: ${message}についての洞察を提供します。`;
      
      // AI応答を保存
      await req.context.pool.query(
        'INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, \'assistant\', ?)',
        [conversationId, aiResponse]
      );
      
      res.json({
        role: 'assistant',
        content: aiResponse
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /chat/conversations
 * 会話一覧取得
 */
router.get('/conversations',
  authenticateToken,
  rateLimitMiddleware('chat', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      const [rows] = await req.context.pool.query(
        'SELECT * FROM chat_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50',
        [userId]
      );
      
      res.json({ conversations: rows });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
