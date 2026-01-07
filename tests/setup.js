// Jest セットアップファイル
require('dotenv').config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_testing';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/diary_test_db';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// タイムアウト設定
jest.setTimeout(30000);

// コンソール出力を抑制
if (process.env.CI) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// 未処理のPromise rejectionをキャッチ
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// テスト後のクリーンアップ
afterAll(async () => {
  // 少し待ってから終了（接続クローズを待つ）
  await new Promise(resolve => setTimeout(resolve, 500));
});
