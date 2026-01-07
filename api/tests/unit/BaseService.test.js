/**
 * BaseService Unit Tests
 * BaseServiceのユニットテスト
 */

import { BaseService } from '../../services/BaseService.js';
import { ApiError } from '../../middleware/errorHandler.js';

describe('BaseService', () => {
  let service;
  let mockPool;
  let mockRedis;

  beforeEach(() => {
    mockPool = {
      getConnection: jest.fn()
    };
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };
    service = new BaseService(mockPool, mockRedis);
  });

  describe('getFromCache', () => {
    test('キャッシュが存在する場合は値を返す', async () => {
      const cachedData = { id: 1, name: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getFromCache('test-key');
      expect(result).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    test('キャッシュが存在しない場合はデフォルト値を返す', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getFromCache('test-key', 'default');
      expect(result).toBe('default');
    });

    test('Redis接続がない場合はデフォルト値を返す', async () => {
      const serviceWithoutRedis = new BaseService(mockPool, null);
      const result = await serviceWithoutRedis.getFromCache('test-key', 'default');
      expect(result).toBe('default');
    });
  });

  describe('setCache', () => {
    test('データをキャッシュに保存する', async () => {
      const data = { id: 1, name: 'test' };
      await service.setCache('test-key', data, 300);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(data),
        { EX: 300 }
      );
    });
  });

  describe('deleteCache', () => {
    test('キャッシュを削除する', async () => {
      await service.deleteCache('test-key');
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('handleError', () => {
    test('ApiErrorをそのまま投げる', () => {
      const apiError = new ApiError('TEST_ERROR', 'Test error', 400);
      expect(() => service.handleError(apiError)).toThrow(ApiError);
    });

    test('通常のエラーをApiErrorに変換する', () => {
      const error = new Error('Test error');
      expect(() => service.handleError(error)).toThrow(ApiError);
    });
  });
});
