/**
 * エラーハンドリングミドルウェア
 * 統一されたエラーレスポンス形式を提供
 */

/**
 * カスタムAPIエラークラス
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * グローバルエラーハンドラー
 */
export function errorHandler(err, req, res, next) {
  // ApiErrorの場合
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // MySQLエラーの場合
  if (err.code && err.code.startsWith('ER_')) {
    console.error(`[${req.method} ${req.path}] MySQL Error:`, err.code, err.sqlMessage);
    return res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        details: process.env.NODE_ENV === 'development' ? {
          mysql_code: err.code,
          message: err.sqlMessage
        } : null
      }
    });
  }

  // その他の予期しないエラー
  console.error(`[${req.method} ${req.path}] Unexpected Error:`, err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? {
        message: err.message,
        stack: err.stack
      } : null
    }
  });
}

/**
 * 404ハンドラー
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`
    }
  });
}
