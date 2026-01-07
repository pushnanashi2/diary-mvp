/**
 * Sharing Router
 * 共有リンク生成・API
 */

import express from 'express';
import { ulid } from 'ulid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { JWT_SECRET } from '../config/secrets.js';
import * as entryQueries from '../queries/entryQueries.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /sharing/create
 * 共有リンクを生成
 */
router.post('/create',
  authenticateToken,
  rateLimitMiddleware('sharing', 10),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { entry_public_id, password, expires_in_hours, max_views } = req.body;
      
      if (!entry_public_id) {
        throw new ApiError('MISSING_ENTRY_ID', 'entry_public_id is required', 400);
      }
      
      // エントリの所有権確認
      const entry = await entryQueries.getEntryByPublicId(
        req.context.pool,
        entry_public_id,
        userId
      );
      
      if (!entry) {
        throw new ApiError('ENTRY_NOT_FOUND', 'Entry not found', 404);
      }
      
      const publicId = ulid();
      const accessToken = jwt.sign(
        { linkId: publicId, entryId: entry.id },
        JWT_SECRET,
        { expiresIn: expires_in_hours ? `${expires_in_hours}h` : '7d' }
      );
      
      // パスワードハッシュ
      let passwordHash = null;
      if (password) {
        passwordHash = await bcrypt.hash(password, 10);
      }
      
      // 有効期限計算
      let expiresAt = null;
      if (expires_in_hours) {
        expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);
      }
      
      // DBに保存
      const sql = `
        INSERT INTO shared_links
        (entry_id, user_id, public_id, access_token, password_hash, expires_at, max_views)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      await req.context.pool.query(sql, [
        entry.id,
        userId,
        publicId,
        accessToken,
        passwordHash,
        expiresAt,
        max_views || null
      ]);
      
      res.status(201).json({
        public_id: publicId,
        access_token: accessToken,
        expires_at: expiresAt,
        max_views: max_views || null,
        password_protected: !!password
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /sharing/:access_token
 * 共有リンク経由でエントリを取得
 */
router.get('/:access_token',
  rateLimitMiddleware('sharing-view', 30),
  async (req, res, next) => {
    try {
      const { access_token } = req.params;
      const { password } = req.query;
      
      // 共有リンク情報を取得
      const [links] = await req.context.pool.query(
        'SELECT * FROM shared_links WHERE access_token = ? AND is_active = 1',
        [access_token]
      );
      
      if (links.length === 0) {
        throw new ApiError('LINK_NOT_FOUND', 'Shared link not found or expired', 404);
      }
      
      const link = links[0];
      
      // 有効期限チェック
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        throw new ApiError('LINK_EXPIRED', 'Shared link has expired', 410);
      }
      
      // 閲覧回数チェック
      if (link.max_views && link.view_count >= link.max_views) {
        throw new ApiError('MAX_VIEWS_REACHED', 'Maximum view count reached', 403);
      }
      
      // パスワードチェック
      if (link.password_hash) {
        if (!password) {
          throw new ApiError('PASSWORD_REQUIRED', 'Password is required', 401);
        }
        const isValid = await bcrypt.compare(password, link.password_hash);
        if (!isValid) {
          throw new ApiError('INVALID_PASSWORD', 'Invalid password', 401);
        }
      }
      
      // 閲覧回数をインクリメント
      await req.context.pool.query(
        'UPDATE shared_links SET view_count = view_count + 1, last_accessed_at = NOW() WHERE id = ?',
        [link.id]
      );
      
      // エントリデータを取得
      const [entries] = await req.context.pool.query(
        'SELECT id, public_id, title, created_at, summary_text FROM entries WHERE id = ?',
        [link.entry_id]
      );
      
      if (entries.length === 0) {
        throw new ApiError('ENTRY_NOT_FOUND', 'Entry not found', 404);
      }
      
      res.json(entries[0]);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /sharing/:public_id
 * 共有リンクを無効化
 */
router.delete('/:public_id',
  authenticateToken,
  rateLimitMiddleware('sharing', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      
      const [result] = await req.context.pool.query(
        'UPDATE shared_links SET is_active = 0 WHERE public_id = ? AND user_id = ?',
        [public_id, userId]
      );
      
      if (result.affectedRows === 0) {
        throw new ApiError('LINK_NOT_FOUND', 'Shared link not found', 404);
      }
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
