/**
 * JWT認証ミドルウェア
 */

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/secrets.js';
import { getConnection } from '../config/database.js';

/**
 * 必須認証ミドルウェア
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = Number(payload.sub);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

/**
 * オプショナル認証ミドルウェア
 * トークンがあれば検証、なければスルー
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    // トークンがない場合はスルー
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = Number(payload.sub);
  } catch (err) {
    // トークンが無効でもスルー（エラーにしない）
  }
  
  next();
}

/**
 * 管理者権限チェックミドルウェア
 * authenticateToken の後に使用すること
 */
export async function isAdmin(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ 
      error: { 
        code: 'UNAUTHORIZED',
        message: 'Authentication required' 
      } 
    });
  }

  try {
    const db = await getConnection();
    const [admins] = await db.query(
      'SELECT id, role FROM admins WHERE user_id = ? AND is_active = true',
      [req.userId]
    );

    if (admins.length === 0) {
      return res.status(403).json({ 
        error: { 
          code: 'FORBIDDEN',
          message: 'Admin privileges required' 
        } 
      });
    }

    req.adminId = admins[0].id;
    req.adminRole = admins[0].role;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify admin privileges' 
      } 
    });
  }
}

// 後方互換のためのエイリアス
export const auth = authenticateToken;
