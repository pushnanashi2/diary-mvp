/**
 * 秘密情報の読み込み
 * .secrets/ディレクトリからキーを読み込む
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// 修正: config/ からプロジェクトルートへ（1つ上）
const projectRoot = join(__dirname, '..');

/**
 * ファイルから秘密情報を読み込む
 * @param {string} filename - .secrets/内のファイル名
 * @param {string} fallbackEnv - フォールバックする環境変数名
 * @returns {string|null}
 */
function readSecret(filename, fallbackEnv = null) {
  const secretPath = join(projectRoot, '.secrets', filename);

  if (existsSync(secretPath)) {
    return readFileSync(secretPath, 'utf-8').trim();
  }

  // ファイルがなければ環境変数を使用
  if (fallbackEnv && process.env[fallbackEnv]) {
    return process.env[fallbackEnv];
  }

  return null;
}

/**
 * JSON形式の秘密情報を読み込む
 */
function readSecretJson(filename, fallbackEnvPrefix = null) {
  const secretPath = join(projectRoot, '.secrets', filename);

  if (existsSync(secretPath)) {
    const content = readFileSync(secretPath, 'utf-8');
    return JSON.parse(content);
  }

  // フォールバック: 環境変数から読み込み
  if (fallbackEnvPrefix) {
    return {
      host: process.env[`${fallbackEnvPrefix}_HOST`],
      port: Number(process.env[`${fallbackEnvPrefix}_PORT`]),
      database: process.env[`${fallbackEnvPrefix}_DB`],
      user: process.env[`${fallbackEnvPrefix}_USER`],
      password: process.env[`${fallbackEnvPrefix}_PASSWORD`],
    };
  }

  return null;
}

// 秘密情報の読み込み
export const OPENAI_API_KEY = readSecret('openai.key', 'OPENAI_API_KEY');
export const JWT_SECRET = readSecret('jwt.secret', 'JWT_SECRET');
export const DB_CREDENTIALS = readSecretJson('db.creds', 'MYSQL');

// S3/MinIO認証情報（環境変数のみ）
export const S3_CONFIG = {
  endpoint: process.env.S3_ENDPOINT,
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  bucket: process.env.S3_BUCKET || 'audio',
};

// Redis URL（環境変数のみ）
export const REDIS_URL = process.env.REDIS_URL;

// その他の設定
export const APP_CONFIG = {
  port: Number(process.env.PORT || 8000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:8000',
  maxAudioBytes: Number(process.env.MAX_AUDIO_BYTES || 26214400),
  audioLinkTtlSec: Number(process.env.AUDIO_LINK_TTL_SEC || 600),
  rlEntriesPerMin: Number(process.env.RL_ENTRIES_PER_MIN || 30),
  rlSummariesPerMin: Number(process.env.RL_SUMMARIES_PER_MIN || 20),
};
