/**
 * Diary MVP API Server (Phase 3 Refactored)
 */

import express from 'express';
import cors from 'cors';
import { ConnectionManager } from './config/connections.js';
import { runMigrations } from './db/migrations.js';
import { errorHandler } from './middleware/errorHandler.js';
import { APP_CONFIG } from './config/secrets.js';
import logger from './utils/logger.js';

import authRouter from './routes/auth.js';
import entriesRouter from './routes/entries.js';
import summariesRouter from './routes/summaries.js';
import userRouter from './routes/user.js';
import healthRouter from './routes/health.js';

const app = express();
const connectionManager = new ConnectionManager();

app.use(cors({ origin: APP_CONFIG.corsOrigin }));
app.use(express.json());
app.use(connectionManager.middleware());

app.use('/auth', authRouter);
app.use('/entries', entriesRouter);
app.use('/summaries', summariesRouter);
app.use('/me', userRouter);
app.use('/health', healthRouter);

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

app.use(errorHandler);

async function start() {
  try {
    logger.info('Starting Diary MVP API Server...', { nodeEnv: process.env.NODE_ENV, port: APP_CONFIG.port });
    await connectionManager.initializeAll();
    await runMigrations(connectionManager.pool);
    app.listen(APP_CONFIG.port, () => {
      logger.info('Server started successfully', { port: APP_CONFIG.port, bucket: connectionManager.bucket });
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down...');
      await connectionManager.cleanup();
      process.exit(0);
    });
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down...');
      await connectionManager.cleanup();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

start();