/**
 * Error Handler Middleware (Refactored)
 * エラーハンドリングの統一化と改善
 */

import { logger } from '../utils/logger.js';

/**
 * カスタムエラークラス
 */
export class ApiError extends Error {
  constructor(code, message, statusCode = 500, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * エラーハンドリングミドルウェア
 */
export function errorHandler(err, req, res, next) {
  // デフォルト値
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details = null;

  // ApiErrorの場合
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }
  // バリデーションエラー
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
    details = err.errors;
  }
  // JWT関連エラー
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }
  // データベースエラー
  else if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'Resource already exists';
  }
  else if (err.code && err.code.startsWith('ER_')) {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = 'Database operation failed';
  }
  // その他のエラー
  else if (err.message) {
    message = err.message;
  }

  // エラーログ出力
  if (statusCode >= 500) {
    logger.error(`[ERROR] ${code}: ${message}`, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.userId
    });
  } else {
    logger.warn(`[WARNING] ${code}: ${message}`, {
      url: req.originalUrl,
      method: req.method
    });
  }

  // レスポンス
  const response = {
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };

  res.status(statusCode).json(response);
}

/**
 * 404ハンドラー
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
}

/**
 * 非同期ハンドラーラッパー
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
