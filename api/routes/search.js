/**
 * Search Router
 * 全文検索・セマンティック検索API
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /search/fulltext
 * 全文検索（MySQL FULLTEXT）
 */
router.get('/fulltext',
  authenticateToken,
  rateLimitMiddleware('search', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { q, limit = 50 } = req.query;
      
      if (!q || q.trim().length === 0) {
        throw new ApiError('MISSING_QUERY', 'Search query is required', 400);
      }
      
      // MySQL FULLTEXT 検索
      const sql = `
        SELECT 
          id,
          public_id,
          title,
          created_at,
          summary_text,
          MATCH(title, transcript_text, summary_text) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
        FROM entries
        WHERE user_id = ?
          AND content_flagged = 0
          AND MATCH(title, transcript_text, summary_text) AGAINST(? IN NATURAL LANGUAGE MODE)
        ORDER BY relevance DESC
        LIMIT ?
      `;
      
      const [rows] = await req.context.pool.query(sql, [
        q,
        userId,
        q,
        parseInt(limit)
      ]);
      
      res.json({
        query: q,
        total: rows.length,
        results: rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /search/semantic
 * セマンティック検索（エンベディング基準）
 * 注: OpenAI Embeddings APIを使用（別途バックグラウンド処理が必要）
 */
router.get('/semantic',
  authenticateToken,
  rateLimitMiddleware('search', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { q, limit = 10 } = req.query;
      
      if (!q || q.trim().length === 0) {
        throw new ApiError('MISSING_QUERY', 'Search query is required', 400);
      }
      
      // 今回はシンプルな全文検索にフォールバック
      // 実際のセマンティック検索は OpenAI Embeddings + コサイン類似度で実装
      const sql = `
        SELECT 
          id,
          public_id,
          title,
          created_at,
          summary_text
        FROM entries
        WHERE user_id = ?
          AND content_flagged = 0
          AND (title LIKE ? OR transcript_text LIKE ? OR summary_text LIKE ?)
        ORDER BY created_at DESC
        LIMIT ?
      `;
      
      const searchPattern = `%${q}%`;
      const [rows] = await req.context.pool.query(sql, [
        userId,
        searchPattern,
        searchPattern,
        searchPattern,
        parseInt(limit)
      ]);
      
      res.json({
        query: q,
        total: rows.length,
        results: rows,
        note: 'Full semantic search with embeddings requires background processing'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /search/related/:public_id
 * 関連エントリ推薦（タグ・キーワード基準）
 */
router.get('/related/:public_id',
  authenticateToken,
  rateLimitMiddleware('search', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      const { limit = 5 } = req.query;
      
      // 対象エントリのタグを取得
      const [entry] = await req.context.pool.query(
        'SELECT id FROM entries WHERE public_id = ? AND user_id = ?',
        [public_id, userId]
      );
      
      if (entry.length === 0) {
        throw new ApiError('ENTRY_NOT_FOUND', 'Entry not found', 404);
      }
      
      const entryId = entry[0].id;
      
      // 共通タグを持つエントリを探す
      const sql = `
        SELECT 
          e.id,
          e.public_id,
          e.title,
          e.created_at,
          e.summary_text,
          COUNT(DISTINCT et2.tag) as common_tags
        FROM entries e
        INNER JOIN entry_tags et2 ON e.id = et2.entry_id
        WHERE et2.tag IN (
          SELECT tag FROM entry_tags WHERE entry_id = ?
        )
        AND e.user_id = ?
        AND e.id != ?
        AND e.content_flagged = 0
        GROUP BY e.id
        ORDER BY common_tags DESC, e.created_at DESC
        LIMIT ?
      `;
      
      const [rows] = await req.context.pool.query(sql, [
        entryId,
        userId,
        entryId,
        parseInt(limit)
      ]);
      
      res.json({
        entry_public_id: public_id,
        related_entries: rows
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
