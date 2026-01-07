/**
 * 認証ルーター
 * POST /auth/register - ユーザー登録
 * POST /auth/login - ログイン
 */
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail } from '../queries/userQueries.js';
import { JWT_SECRET } from '../config/secrets.js';
import { ApiError } from '../middleware/errorHandler.js';

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

    const pool = req.pool;
    
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
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new ApiError(400, 'BAD_REQUEST', 'Email and password are required');
    }

    const pool = req.pool;
    
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

export default router;
