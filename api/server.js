/**
 * Main Server (Refactored)
 * Expressサーバーのエントリポイント
 */

import express from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { initializeRedis, closeRedis } from './config/redis.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Routes
import authRouter from './routes/auth.js';
import entriesRouter from './routes/entries.js';
import summariesRouter from './routes/summaries.js';
import actionItemsRouter from './routes/actionItems.js';
import analyticsRouter from './routes/analytics.js';
import sharingRouter from './routes/sharing.js';
import remindersRouter from './routes/reminders.js';
import searchRouter from './routes/search.js';
import teamsRouter from './routes/teams.js';
import reportsRouter from './routes/reports.js';
import chatRouter from './routes/chat.js';
import coachingRouter from './routes/coaching.js';
import audioRouter from './routes/audio.js';

const app = express();
const PORT = process.env.PORT || 3000;

// グローバルミドルウェア
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// リクエストロギング
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// APIルート
app.use('/auth', authRouter);
app.use('/entries', entriesRouter);
app.use('/summaries', summariesRouter);
app.use('/action-items', actionItemsRouter);
app.use('/analytics', analyticsRouter);
app.use('/sharing', sharingRouter);
app.use('/reminders', remindersRouter);
app.use('/search', searchRouter);
app.use('/teams', teamsRouter);
app.use('/reports', reportsRouter);
app.use('/chat', chatRouter);
app.use('/coaching', coachingRouter);
app.use('/audio', audioRouter);

// 404ハンドラー
app.use(notFoundHandler);

// エラーハンドラー
app.use(errorHandler);

// サーバー起動
let server;

async function startServer() {
  try {
    // データベース初期化
    await initializeDatabase({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DB || 'diary_db',
      connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10')
    });

    // Redis初期化
    await initializeRedis(process.env.REDIS_URL || 'redis://localhost:6379');

    // サーバー起動
    server = app.listen(PORT, () => {
      logger.info(`[SERVER] Listening on port ${PORT}`);
      logger.info(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('[SERVER] Failed to start:', error);
    process.exit(1);
  }
}

// グレースフルシャットダウン
async function shutdown(signal) {
  logger.info(`[SERVER] ${signal} received, shutting down gracefully...`);

  if (server) {
    server.close(async () => {
      logger.info('[SERVER] HTTP server closed');
      
      try {
        await closeDatabase();
        await closeRedis();
        logger.info('[SERVER] All connections closed');
        process.exit(0);
      } catch (error) {
        logger.error('[SERVER] Error during shutdown:', error);
        process.exit(1);
      }
    });

    // 強制終了タイマー (30秒)
    setTimeout(() => {
      logger.error('[SERVER] Forcing shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// 未処理エラーハンドリング
process.on('uncaughtException', (error) => {
  logger.error('[SERVER] Uncaught Exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

// サーバー起動
startServer();

export default app;
