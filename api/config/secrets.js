/**
 * Secrets Configuration (Refactored)
 * ConfigLoaderを使用した統一設定読み込み
 */

import { getConfigLoader } from '../utils/configLoader.js';

const loader = getConfigLoader();

// 秘密情報
export const OPENAI_API_KEY = loader.loadSecret('openai.key', 'OPENAI_API_KEY', { required: false });
export const JWT_SECRET = loader.loadSecret('jwt.secret', 'JWT_SECRET', { required: true });

// データベース設定
export const DB_CONFIG = loader.loadDbConfig();

// Redis設定
export const REDIS_CONFIG = loader.loadRedisConfig();

// ストレージ設定
export const STORAGE_CONFIG = loader.loadStorageConfig();

// アプリケーション設定
export const APP_CONFIG = loader.loadAppConfig();

// レガシー互換性のためのエイリアス
export const DB_CREDENTIALS = DB_CONFIG;
export const REDIS_URL = REDIS_CONFIG.url;
export const S3_CONFIG = {
  endpoint: STORAGE_CONFIG.endpoint,
  accessKey: STORAGE_CONFIG.accessKey,
  secretKey: STORAGE_CONFIG.secretKey,
  bucket: STORAGE_CONFIG.bucket
};
