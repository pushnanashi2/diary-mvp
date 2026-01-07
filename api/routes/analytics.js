/**
 * Analytics Router
 * 感情推移グラフなどの分析データAPI
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /analytics/emotion-timeline
 * 感情推移グラフデータを取得
 */
router.get('/emotion-timeline',
  authenticateToken,
  rateLimitMiddleware('analytics', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { start_date, end_date, granularity = 'day' } = req.query;
      
      // デフォルト: 過去30日間
      const endDate = end_date || new Date().toISOString().split('T')[0];
      const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // 粒度のバリデーション
      if (!['day', 'week', 'month'].includes(granularity)) {
        throw new ApiError('INVALID_GRANULARITY', 'Granularity must be day, week, or month', 400);
      }
      
      // 日付形式でグループ化
      let dateFormat;
      switch (granularity) {
        case 'day':
          dateFormat = '%Y-%m-%d';
          break;
        case 'week':
          dateFormat = '%Y-%u';
          break;
        case 'month':
          dateFormat = '%Y-%m';
          break;
      }
      
      const sql = `
        SELECT 
          DATE_FORMAT(e.created_at, ?) as period,
          AVG(ea.valence) as avg_valence,
          AVG(ea.arousal) as avg_arousal,
          AVG(ea.dominance) as avg_dominance,
          COUNT(DISTINCT e.id) as entry_count,
          GROUP_CONCAT(DISTINCT ea.primary_emotion) as emotions
        FROM entries e
        INNER JOIN emotion_analysis ea ON e.id = ea.entry_id
        WHERE e.user_id = ?
          AND DATE(e.created_at) BETWEEN ? AND ?
          AND e.content_flagged = 0
        GROUP BY period
        ORDER BY period ASC
      `;
      
      const [rows] = await req.context.pool.query(sql, [
        dateFormat,
        userId,
        startDate,
        endDate
      ]);
      
      // データ整形
      const timeline = rows.map(row => ({
        period: row.period,
        valence: parseFloat(row.avg_valence),
        arousal: parseFloat(row.avg_arousal),
        dominance: parseFloat(row.avg_dominance),
        entry_count: row.entry_count,
        emotions: row.emotions ? row.emotions.split(',') : []
      }));
      
      res.json({
        start_date: startDate,
        end_date: endDate,
        granularity,
        timeline
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analytics/summary
 * 総合分析サマリー
 */
router.get('/summary',
  authenticateToken,
  rateLimitMiddleware('analytics', 20),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { days = 30 } = req.query;
      
      const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // 基本統計
      const [statsRows] = await req.context.pool.query(`
        SELECT 
          COUNT(DISTINCT e.id) as total_entries,
          AVG(ea.valence) as avg_valence,
          AVG(ea.arousal) as avg_arousal,
          COUNT(DISTINCT et.tag) as total_tags,
          COUNT(DISTINCT ai.id) as total_action_items,
          COUNT(DISTINCT CASE WHEN ai.status = 'completed' THEN ai.id END) as completed_action_items
        FROM entries e
        LEFT JOIN emotion_analysis ea ON e.id = ea.entry_id
        LEFT JOIN entry_tags et ON e.id = et.entry_id
        LEFT JOIN action_items ai ON e.id = ai.entry_id
        WHERE e.user_id = ?
          AND DATE(e.created_at) >= ?
          AND e.content_flagged = 0
      `, [userId, startDate]);
      
      // 最頻出の感情
      const [emotionRows] = await req.context.pool.query(`
        SELECT 
          ea.primary_emotion,
          COUNT(*) as count
        FROM entries e
        INNER JOIN emotion_analysis ea ON e.id = ea.entry_id
        WHERE e.user_id = ?
          AND DATE(e.created_at) >= ?
          AND e.content_flagged = 0
        GROUP BY ea.primary_emotion
        ORDER BY count DESC
        LIMIT 5
      `, [userId, startDate]);
      
      // 最頻出のタグ
      const [tagRows] = await req.context.pool.query(`
        SELECT 
          et.tag,
          COUNT(*) as count
        FROM entries e
        INNER JOIN entry_tags et ON e.id = et.entry_id
        WHERE e.user_id = ?
          AND DATE(e.created_at) >= ?
        GROUP BY et.tag
        ORDER BY count DESC
        LIMIT 10
      `, [userId, startDate]);
      
      const stats = statsRows[0];
      
      res.json({
        period_days: parseInt(days),
        total_entries: stats.total_entries,
        avg_valence: parseFloat(stats.avg_valence) || 0,
        avg_arousal: parseFloat(stats.avg_arousal) || 0,
        total_tags: stats.total_tags,
        total_action_items: stats.total_action_items,
        completed_action_items: stats.completed_action_items,
        top_emotions: emotionRows.map(r => ({ emotion: r.primary_emotion, count: r.count })),
        top_tags: tagRows.map(r => ({ tag: r.tag, count: r.count }))
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
