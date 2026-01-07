// Jest セットアップファイル
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_testing';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/diary_test_db';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// タイムアウト設定
jest.setTimeout(30000);

// グローバルなモック設定
global.console = {
  ...console,
  error: jest.fn(), // テスト中のエラーログを抑制
  warn: jest.fn(),
};

// データベース接続のモック（必要に応じて）
jest.mock('../api/config/database', () => {
  return {
    query: jest.fn(),
    end: jest.fn(),
  };
});

// Redis接続のモック（必要に応じて）
jest.mock('../api/config/redis', () => {
  return {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
  };
});

// OpenAI APIのモック
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Test response' } }]
          })
        }
      },
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue({ text: 'Test transcription' })
        }
      }
    }))
  };
});

// テスト後のクリーンアップ
afterAll(async () => {
  // データベース接続を閉じる
  const db = require('../api/config/database');
  if (db && db.end) {
    await db.end();
  }
  
  // Redis接続を閉じる
  const redis = require('../api/config/redis');
  if (redis && redis.quit) {
    await redis.quit();
  }
});
