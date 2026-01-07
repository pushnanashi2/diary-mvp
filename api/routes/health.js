/**
 * Health Check Router
 */

import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { pool, redis, minio, s3Bucket } = req.context;
  const startTime = Date.now();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {}
  };

  try {
    await pool.query('SELECT 1');
    health.services.database = { status: 'healthy' };
  } catch (error) {
    health.status = 'unhealthy';
    health.services.database = { status: 'unhealthy', error: error.message };
    logger.error('Database health check failed', { error: error.message });
  }

  try {
    await redis.ping();
    health.services.redis = { status: 'healthy' };
  } catch (error) {
    health.status = 'unhealthy';
    health.services.redis = { status: 'unhealthy', error: error.message };
    logger.error('Redis health check failed', { error: error.message });
  }

  try {
    const bucketExists = await minio.bucketExists(s3Bucket);
    if (!bucketExists) throw new Error(`Bucket ${s3Bucket} does not exist`);
    health.services.minio = { status: 'healthy', bucket: s3Bucket };
  } catch (error) {
    health.status = 'unhealthy';
    health.services.minio = { status: 'unhealthy', error: error.message };
    logger.error('MinIO health check failed', { error: error.message });
  }

  health.response_time_ms = Date.now() - startTime;
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;