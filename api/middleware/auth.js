/**
 * JWT認証ミドルウェア
 */

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/secrets.js';

export function auth(req, res, next) {
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
