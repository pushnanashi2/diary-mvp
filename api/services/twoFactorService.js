/**
 * Two-Factor Authentication Service
 * Phase 4.2: TOTP (Time-based One-Time Password) 実装
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * 2FAシークレットを生成
 */
export function generateSecret(userEmail) {
  const secret = speakeasy.generateSecret({
    name: `Diary MVP (${userEmail})`,
    issuer: 'Diary MVP',
    length: 32
  });
  
  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url
  };
}

/**
 * QRコードを生成（Data URL形式）
 */
export async function generateQRCode(otpauth_url) {
  try {
    const dataUrl = await QRCode.toDataURL(otpauth_url);
    return dataUrl;
  } catch (error) {
    throw new Error('QR_CODE_GENERATION_FAILED');
  }
}

/**
 * TOTPトークンを検証
 */
export function verifyToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2  // ±2ステップ（約60秒の猶予）
  });
}

/**
 * バックアップコードを生成（10個）
 */
export function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // 8文字の英数字コード
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * バックアップコードを検証
 */
export function verifyBackupCode(storedCodes, inputCode) {
  if (!storedCodes || !Array.isArray(storedCodes)) {
    return { valid: false, remainingCodes: [] };
  }
  
  const normalizedInput = inputCode.toUpperCase().replace(/\s/g, '');
  const index = storedCodes.indexOf(normalizedInput);
  
  if (index === -1) {
    return { valid: false, remainingCodes: storedCodes };
  }
  
  // 使用済みコードを削除
  const remainingCodes = storedCodes.filter((_, i) => i !== index);
  return { valid: true, remainingCodes };
}

/**
 * 2FAミドルウェア: トークン検証
 */
export function require2FA(pool) {
  return async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
    }
    
    try {
      const [users] = await pool.query(
        'SELECT two_factor_enabled, two_factor_secret FROM users WHERE id=?',
        [userId]
      );
      
      const user = users[0];
      if (!user || !user.two_factor_enabled) {
        // 2FA未有効の場合はスキップ
        return next();
      }
      
      // 2FA有効の場合、トークンチェック
      const token = req.headers['x-2fa-token'];
      if (!token) {
        return res.status(403).json({ 
          error: { 
            code: '2FA_REQUIRED',
            message: '2FA token required'
          } 
        });
      }
      
      const valid = verifyToken(user.two_factor_secret, token);
      if (!valid) {
        return res.status(403).json({ 
          error: { 
            code: '2FA_INVALID_TOKEN',
            message: 'Invalid 2FA token'
          } 
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

export default {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateBackupCodes,
  verifyBackupCode,
  require2FA
};
