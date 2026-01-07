/**
 * Security Middleware Collection
 * セキュリティミドルウェアの統合モジュール
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { logger } from '../utils/logger.js';

/**
 * セキュリティヘッダー設定
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * グローバルレート制限
 * 全エンドポイントに適用される基本的なレート制限
 */
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 1000, // 15分あたり1000リクエスト
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
      },
    });
  },
});

/**
 * 認証エンドポイント用レート制限
 * ブルートフォース攻撃対策
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 15分あたり5回のログイン試行
  skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again after 15 minutes.',
    },
  },
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(429).json({
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts, please try again later.',
      },
    });
  },
});

/**
 * 入力サニタイゼーション
 * XSS 対策のための入力値のクリーニング
 */
export const sanitizeInput = (req, res, next) => {
  // クエリパラメータのサニタイゼーション
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === 'string') {
        // 基本的な HTML タグの除去
        req.query[key] = req.query[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]+>/g, '')
          .trim();
      }
    });
  }

  // ボディのサニタイゼーション
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        // 基本的な HTML タグの除去
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]+>/g, '')
          .trim();
      }
    });
  }

  next();
};

/**
 * IP ホワイトリストミドルウェア
 * 管理者用エンドポイントのアクセス制限
 */
export const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    if (process.env.NODE_ENV === 'development') {
      // 開発環境ではスキップ
      return next();
    }

    if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
      return next();
    }

    logger.warn('IP not whitelisted', {
      ip: clientIP,
      path: req.path,
    });

    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied from this IP address.',
      },
    });
  };
};

/**
 * セキュリティログミドルウェア
 * セキュリティ関連のイベントをログに記録
 */
export const securityLogger = (req, res, next) => {
  // 認証関連のエンドポイント
  const sensitiveEndpoints = ['/api/auth/', '/api/admin/', '/api/2fa/'];

  if (sensitiveEndpoints.some((endpoint) => req.path.startsWith(endpoint))) {
    logger.info('Security-sensitive request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * CORS 設定
 */
export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:8000'];

    // 開発環境では全てのオリジンを許可
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS rejected', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default {
  securityHeaders,
  globalRateLimit,
  authRateLimit,
  sanitizeInput,
  ipWhitelist,
  securityLogger,
  corsOptions,
};
