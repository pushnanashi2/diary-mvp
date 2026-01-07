/**
 * Connection Manager
 */

import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import { Client as MinioClient } from 'minio';
import { DB_CONFIG, REDIS_CONFIG, STORAGE_CONFIG } from './secrets.js';
import logger from '../utils/logger.js';

export class ConnectionManager {
  constructor() {
    this.pool = null;
    this.redis = null;
    this.minio = null;
    this.bucket = STORAGE_CONFIG.bucket;
  }

  async initializeDatabase() {
    try {
      this.pool = mysql.createPool({
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password,
        database: DB_CONFIG.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      await this.pool.query('SELECT 1');
      logger.info('MySQL connection pool created', { host: DB_CONFIG.host });
      return this.pool;
    } catch (error) {
      logger.error('Failed to initialize MySQL', { error: error.message });
      throw error;
    }
  }

  async initializeRedis() {
    try {
      this.redis = createClient({ url: REDIS_CONFIG.url });
      this.redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
      await this.redis.connect();
      await this.redis.ping();
      logger.info('Redis connected', { url: REDIS_CONFIG.url });
      return this.redis;
    } catch (error) {
      logger.error('Failed to initialize Redis', { error: error.message });
      throw error;
    }
  }

  async initializeStorage() {
    try {
      const endpointUrl = STORAGE_CONFIG.endpoint;
      const [host, port] = endpointUrl.replace('http://', '').replace('https://', '').split(':');
      this.minio = new MinioClient({
        endPoint: host,
        port: parseInt(port || '9000', 10),
        useSSL: STORAGE_CONFIG.useSSL,
        accessKey: STORAGE_CONFIG.accessKey,
        secretKey: STORAGE_CONFIG.secretKey
      });
      const bucketExists = await this.minio.bucketExists(this.bucket);
      if (!bucketExists) {
        await this.minio.makeBucket(this.bucket, 'us-east-1');
        logger.info('MinIO bucket created', { bucket: this.bucket });
      } else {
        logger.info('MinIO bucket exists', { bucket: this.bucket });
      }
      return this.minio;
    } catch (error) {
      logger.error('Failed to initialize MinIO', { error: error.message });
      throw error;
    }
  }

  async initializeAll() {
    await this.initializeDatabase();
    await this.initializeRedis();
    await this.initializeStorage();
    logger.info('All connections initialized');
  }

  async cleanup() {
    try {
      if (this.redis) await this.redis.quit();
      if (this.pool) await this.pool.end();
      logger.info('All connections closed');
    } catch (error) {
      logger.error('Error during cleanup', { error: error.message });
    }
  }

  middleware() {
    return (req, res, next) => {
      req.context = { pool: this.pool, redis: this.redis, minio: this.minio, s3Bucket: this.bucket };
      next();
    };
  }
}

export default ConnectionManager;