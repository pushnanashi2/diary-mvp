/**
 * 認証ルーター
 * POST /auth/register - ユーザー登録
 * POST /auth/login - ログイン
 * POST /auth/2fa/enable - 2FA有効化
 * POST /auth/2fa/verify - 2FA検証
 * POST /auth/2fa/disable - 2FA無効化
 * POST /auth/2fa/verify-backup - バックアップコード検証
 */
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail, getUserById } from '../queries/userQueries.js';
import { JWT_SECRET } from '../config/secrets.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import * as twoFactorService from '../services/twoFactorService.js';

const router = express.Router();

/**
 * POST /auth/register
 * ユーザー登録
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new ApiError(400, 'BAD_REQUEST', 'Email and password are required');
    }

    const pool = req.context.pool;
    
    // 既存ユーザーチェック
    const existing = await getUserByEmail(pool, email);
    if (existing) {
      throw new ApiError(409, 'EMAIL_EXISTS', 'Email already registered');
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(password, 10);
    
    // ユーザー作成
    const userId = await createUser(pool, email, passwordHash);

    // JWT発行
    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      user_id: userId,
      access_token: token
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/login
 * ログイン
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, two_factor_token } = req.body;
    
    if (!email || !password) {
      throw new ApiError(400, 'BAD_REQUEST', 'Email and password are required');
    }

    const pool = req.context.pool;
    
    // ユーザー取得
    const user = await getUserByEmail(pool, email);
    if (!user) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // パスワード検証
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // 2FA有効の場合、トークンチェック
    if (user.two_factor_enabled) {
      if (!two_factor_token) {
        return res.status(403).json({
          error: {
            code: '2FA_REQUIRED',
            message: '2FA token required'
          },
          two_factor_required: true
        });
      }
      
      const tokenValid = twoFactorService.verifyToken(user.two_factor_secret, two_factor_token);
      if (!tokenValid) {
        throw new ApiError(403, '2FA_INVALID_TOKEN', 'Invalid 2FA token');
      }
    }

    // JWT発行
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user_id: user.id,
      access_token: token
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/2fa/enable
 * 2FA有効化（ステップ1: QRコード取得）
 */
router.post('/2fa/enable', authenticateToken, async (req, res, next) => {
  try {
    const pool = req.context.pool;
    const user = await getUserById(pool, req.user.id);
    
    if (user.two_factor_enabled) {
      throw new ApiError(400, '2FA_ALREADY_ENABLED', '2FA is already enabled');
    }
    
    // シークレット生成
    const { secret, otpauth_url } = twoFactorService.generateSecret(user.email);
    
    // QRコード生成
    const qrCode = await twoFactorService.generateQRCode(otpauth_url);
    
    // シークレットを一時保存（まだ有効化はしない）
    await pool.query(
      'UPDATE users SET two_factor_secret=? WHERE id=?',
      [secret, req.user.id]
    );
    
    res.json({
      success: true,
      secret,
      qr_code: qrCode,
      message: 'Scan QR code with your authenticator app, then verify with a token'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/2fa/verify
 * 2FA検証（ステップ2: トークン検証して有効化完了）
 */
router.post('/2fa/verify', authenticateToken, async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      throw new ApiError(400, 'BAD_REQUEST', 'Token is required');
    }
    
    const pool = req.context.pool;
    const user = await getUserById(pool, req.user.id);
    
    if (!user.two_factor_secret) {
      throw new ApiError(400, 'NO_SECRET', 'Call /auth/2fa/enable first');
    }
    
    if (user.two_factor_enabled) {
      throw new ApiError(400, '2FA_ALREADY_ENABLED', '2FA is already enabled');
    }
    
    // トークン検証
    const valid = twoFactorService.verifyToken(user.two_factor_secret, token);
    if (!valid) {
      throw new ApiError(400, 'INVALID_TOKEN', 'Invalid token');
    }
    
    // バックアップコード生成
    const backupCodes = twoFactorService.generateBackupCodes();
    
    // 2FA有効化
    await pool.query(
      `UPDATE users 
       SET two_factor_enabled=1, 
           two_factor_backup_codes=?, 
           two_factor_enabled_at=NOW() 
       WHERE id=?`,
      [JSON.stringify(backupCodes), req.user.id]
    );
    
    res.json({
      success: true,
      backup_codes: backupCodes,
      message: 'Save these backup codes in a safe place. They can be used if you lose access to your authenticator app.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/2fa/disable
 * 2FA無効化
 */
router.post('/2fa/disable', authenticateToken, async (req, res, next) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      throw new ApiError(400, 'BAD_REQUEST', 'Token and password are required');
    }
    
    const pool = req.context.pool;
    const user = await getUserById(pool, req.user.id);
    
    if (!user.two_factor_enabled) {
      throw new ApiError(400, '2FA_NOT_ENABLED', '2FA is not enabled');
    }
    
    // パスワード検証
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new ApiError(401, 'INVALID_PASSWORD', 'Invalid password');
    }
    
    // トークン検証
    const tokenValid = twoFactorService.verifyToken(user.two_factor_secret, token);
    if (!tokenValid) {
      throw new ApiError(403, 'INVALID_TOKEN', 'Invalid 2FA token');
    }
    
    // 2FA無効化
    await pool.query(
      `UPDATE users 
       SET two_factor_enabled=0, 
           two_factor_secret=NULL, 
           two_factor_backup_codes=NULL 
       WHERE id=?`,
      [req.user.id]
    );
    
    res.json({
      success: true,
      message: '2FA has been disabled'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/2fa/verify-backup
 * バックアップコード検証（ログイン時の代替認証）
 */
router.post('/2fa/verify-backup', async (req, res, next) => {
  try {
    const { email, password, backup_code } = req.body;
    
    if (!email || !password || !backup_code) {
      throw new ApiError(400, 'BAD_REQUEST', 'Email, password, and backup_code are required');
    }
    
    const pool = req.context.pool;
    const user = await getUserByEmail(pool, email);
    
    if (!user) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }
    
    // パスワード検証
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }
    
    if (!user.two_factor_enabled) {
      throw new ApiError(400, '2FA_NOT_ENABLED', '2FA is not enabled');
    }
    
    // バックアップコード検証
    const storedCodes = JSON.parse(user.two_factor_backup_codes || '[]');
    const { valid, remainingCodes } = twoFactorService.verifyBackupCode(storedCodes, backup_code);
    
    if (!valid) {
      throw new ApiError(403, 'INVALID_BACKUP_CODE', 'Invalid backup code');
    }
    
    // 使用済みコードを削除して更新
    await pool.query(
      'UPDATE users SET two_factor_backup_codes=? WHERE id=?',
      [JSON.stringify(remainingCodes), user.id]
    );
    
    // JWT発行
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      user_id: user.id,
      access_token: token,
      remaining_backup_codes: remainingCodes.length,
      message: remainingCodes.length === 0 
        ? 'Warning: All backup codes used. Generate new ones in settings.'
        : `${remainingCodes.length} backup codes remaining`
    });
  } catch (err) {
    next(err);
  }
});

export default router;
