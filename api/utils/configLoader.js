/**
 * Configuration Loader
 * 統一された設定読み込みユーティリティ
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

export class ConfigLoader {
  loadSecret(filename, envFallback = null, options = {}) {
    const { required = false, defaultValue = null } = options;
    const secretPath = join(projectRoot, '.secrets', filename);

    if (existsSync(secretPath)) {
      const value = readFileSync(secretPath, 'utf-8').trim();
      if (value) return value;
    }

    if (envFallback && process.env[envFallback]) {
      return process.env[envFallback];
    }

    if (defaultValue !== null) return defaultValue;
    if (required) throw new Error(`Required secret not found: ${filename}`);
    return null;
  }

  loadJsonSecret(filename, envPrefix = null, options = {}) {
    const { required = false, schema = null } = options;
    const secretPath = join(projectRoot, '.secrets', filename);

    if (existsSync(secretPath)) {
      try {
        const content = readFileSync(secretPath, 'utf-8');
        const data = JSON.parse(content);
        if (schema) this._validateSchema(data, schema, filename);
        return data;
      } catch (error) {
        throw new Error(`Failed to parse JSON secret ${filename}: ${error.message}`);
      }
    }

    if (envPrefix) {
      const data = this._loadFromEnvPrefix(envPrefix, schema);
      if (data && Object.keys(data).length > 0) return data;
    }

    if (required) throw new Error(`Required JSON secret not found: ${filename}`);
    return null;
  }

  loadDbConfig() {
    return this.loadJsonSecret('db.creds', 'MYSQL', {
      required: true,
      schema: { host: 'string', port: 'number', database: 'string', user: 'string', password: 'string' }
    });
  }

  loadRedisConfig() {
    const url = this.loadSecret('redis.url', 'REDIS_URL', { required: true, defaultValue: 'redis://redis:6379' });
    return { url };
  }

  loadStorageConfig() {
    return {
      endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
      accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.S3_SECRET_KEY || 'minio_password',
      bucket: process.env.S3_BUCKET || 'audio',
      useSSL: (process.env.S3_USE_SSL || 'false') === 'true'
    };
  }

  loadAppConfig() {
    return {
      port: parseInt(process.env.PORT || '8000', 10),
      publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:8000',
      maxAudioBytes: parseInt(process.env.MAX_AUDIO_BYTES || '26214400', 10),
      audioLinkTtlSec: parseInt(process.env.AUDIO_LINK_TTL_SEC || '600', 10),
      rlEntriesPerMin: parseInt(process.env.RL_ENTRIES_PER_MIN || '30', 10),
      rlSummariesPerMin: parseInt(process.env.RL_SUMMARIES_PER_MIN || '20', 10),
      corsOrigin: process.env.CORS_ORIGIN || '*'
    };
  }

  _loadFromEnvPrefix(prefix, schema) {
    if (!schema) return {};
    const data = {};
    for (const [key, type] of Object.entries(schema)) {
      const envKey = `${prefix}_${key.toUpperCase()}`;
      const value = process.env[envKey];
      if (value !== undefined) data[key] = type === 'number' ? Number(value) : value;
    }
    return data;
  }

  _validateSchema(data, schema, filename) {
    for (const [key, expectedType] of Object.entries(schema)) {
      if (!(key in data)) throw new Error(`Missing required field '${key}' in ${filename}`);
      const actualType = typeof data[key];
      if (actualType !== expectedType) {
        throw new Error(`Invalid type for '${key}' in ${filename}: expected ${expectedType}, got ${actualType}`);
      }
    }
  }
}

let _loader = null;
export function getConfigLoader() {
  if (!_loader) _loader = new ConfigLoader();
  return _loader;
}

export default ConfigLoader;