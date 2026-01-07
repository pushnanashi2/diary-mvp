/**
 * Entry Service
 * エントリー関連のビジネスロジック
 */

import { ulid } from 'ulid';
import { BaseService } from './BaseService.js';
import { ApiError } from '../middleware/errorHandler.js';
import { validateULID, validateRequired } from '../utils/validators.js';
import * as entryQueries from '../queries/entryQueries.js';

export class EntryService extends BaseService {
  /**
   * エントリーを作成
   */
  async createEntry(userId, title, audioUrl) {
    validateRequired(userId, 'userId');
    validateRequired(title, 'title');
    validateRequired(audioUrl, 'audioUrl');

    try {
      const publicId = ulid();
      
      await entryQueries.createEntry(
        this.pool,
        userId,
        publicId,
        title,
        audioUrl
      );

      // キャッシュを無効化
      await this.deleteCache(`entries:user:${userId}`);

      return {
        public_id: publicId,
        title,
        status: 'processing'
      };
    } catch (error) {
      this.handleError(error, 'createEntry');
    }
  }

  /**
   * エントリー一覧を取得（キャッシュ対応）
   */
  async listEntries(userId, limit = 50) {
    validateRequired(userId, 'userId');

    const cacheKey = `entries:user:${userId}:limit:${limit}`;
    
    // キャッシュチェック
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const entries = await entryQueries.listEntries(this.pool, userId, limit);
      
      // キャッシュに保存（5分）
      await this.setCache(cacheKey, entries, 300);
      
      return entries;
    } catch (error) {
      this.handleError(error, 'listEntries');
    }
  }

  /**
   * エントリーを取得
   */
  async getEntry(publicId, userId) {
    validateULID(publicId, 'public_id');
    validateRequired(userId, 'userId');

    try {
      const entry = await entryQueries.getEntryByPublicId(
        this.pool,
        publicId,
        userId
      );

      if (!entry) {
        throw new ApiError('ENTRY_NOT_FOUND', 'Entry not found', 404);
      }

      return entry;
    } catch (error) {
      this.handleError(error, 'getEntry');
    }
  }

  /**
   * エントリーを削除
   */
  async deleteEntry(publicId, userId) {
    validateULID(publicId, 'public_id');
    validateRequired(userId, 'userId');

    try {
      const deleted = await entryQueries.deleteEntry(
        this.pool,
        publicId,
        userId
      );

      if (!deleted) {
        throw new ApiError('ENTRY_NOT_FOUND', 'Entry not found', 404);
      }

      // キャッシュを無効化
      await this.deleteCache(`entries:user:${userId}`);

      return true;
    } catch (error) {
      this.handleError(error, 'deleteEntry');
    }
  }

  /**
   * エントリーの所有権を確認
   */
  async verifyOwnership(publicId, userId) {
    validateULID(publicId, 'public_id');
    validateRequired(userId, 'userId');

    try {
      const exists = await entryQueries.checkEntryExists(
        this.pool,
        publicId,
        userId
      );

      if (!exists) {
        throw new ApiError('ENTRY_NOT_FOUND', 'Entry not found or access denied', 404);
      }

      return true;
    } catch (error) {
      this.handleError(error, 'verifyOwnership');
    }
  }
}
