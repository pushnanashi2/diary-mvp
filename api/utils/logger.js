/**
 * 構造化ログユーティリティ
 * JSON形式でログを出力し、ログ解析ツールでの検索を容易にする
 */

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

/**
 * ログを構造化してJSON出力
 */
function log(level, message, metadata = {}) {
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...metadata
  };

  const output = JSON.stringify(logEntry);

  if (level === LOG_LEVELS.ERROR) {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message, metadata) => log(LOG_LEVELS.DEBUG, message, metadata),
  info: (message, metadata) => log(LOG_LEVELS.INFO, message, metadata),
  warn: (message, metadata) => log(LOG_LEVELS.WARN, message, metadata),
  error: (message, error, metadata = {}) => {
    log(LOG_LEVELS.ERROR, message, {
      ...metadata,
      error: {
        message: error?.message,
        stack: error?.stack,
        code: error?.code
      }
    });
  }
};

/**
 * Express用リクエストロガーミドルウェア
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      user_id: req.userId || null,
      ip: req.ip
    });
  });

  next();
}
