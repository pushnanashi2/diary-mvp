/**
 * Teams Router
 * チーム・グループ機能API
 */

import express from 'express';
import { ulid } from 'ulid';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /teams
 * チームを作成
 */
router.post('/',
  authenticateToken,
  rateLimitMiddleware('teams', 10),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { name, description } = req.body;
      
      if (!name) {
        throw new ApiError('MISSING_NAME', 'Team name is required', 400);
      }
      
      const publicId = ulid();
      
      // チーム作成
      const [result] = await req.context.pool.query(
        'INSERT INTO teams (public_id, name, description, owner_id) VALUES (?, ?, ?, ?)',
        [publicId, name, description || null, userId]
      );
      
      const teamId = result.insertId;
      
      // 作成者をownerとして追加
      await req.context.pool.query(
        'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, \'owner\')',
        [teamId, userId]
      );
      
      res.status(201).json({
        id: teamId,
        public_id: publicId,
        name,
        description,
        role: 'owner'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /teams
 * 自分が所属するチーム一覧
 */
router.get('/',
  authenticateToken,
  rateLimitMiddleware('teams', 30),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      const sql = `
        SELECT 
          t.id,
          t.public_id,
          t.name,
          t.description,
          tm.role,
          tm.joined_at,
          (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
        FROM teams t
        INNER JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ?
        ORDER BY tm.joined_at DESC
      `;
      
      const [rows] = await req.context.pool.query(sql, [userId]);
      
      res.json({ teams: rows });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /teams/:public_id/members
 * メンバーを追加
 */
router.post('/:public_id/members',
  authenticateToken,
  rateLimitMiddleware('teams', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { public_id } = req.params;
      const { user_email, role = 'member' } = req.body;
      
      // チーム取得と権限確認
      const [teams] = await req.context.pool.query(
        `SELECT t.id FROM teams t
         INNER JOIN team_members tm ON t.id = tm.team_id
         WHERE t.public_id = ? AND tm.user_id = ? AND tm.role IN ('owner', 'admin')`,
        [public_id, userId]
      );
      
      if (teams.length === 0) {
        throw new ApiError('TEAM_NOT_FOUND_OR_NO_PERMISSION', 'Team not found or insufficient permissions', 403);
      }
      
      const teamId = teams[0].id;
      
      // 追加するユーザーを検索
      const [users] = await req.context.pool.query(
        'SELECT id FROM users WHERE email = ?',
        [user_email]
      );
      
      if (users.length === 0) {
        throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      const newUserId = users[0].id;
      
      // メンバー追加
      await req.context.pool.query(
        'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
        [teamId, newUserId, role]
      );
      
      res.status(201).json({
        message: 'Member added successfully',
        user_id: newUserId,
        role
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        next(new ApiError('ALREADY_MEMBER', 'User is already a team member', 409));
      } else {
        next(error);
      }
    }
  }
);

export default router;
