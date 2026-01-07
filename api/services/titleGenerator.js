/**
 * タイトル生成サービス
 * エントリのタイトルを自動生成
 */
import { getUtcDateParts } from '../utils/dateUtils.js';
import { incrementDailyCounter } from '../queries/dailyCounterQueries.js';

export class TitleGenerator {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * エントリタイトルを生成
   * フォーマット: YYYY-MM-DD-HH-MM-#N
   * @param {number} userId - ユーザーID
   * @param {Date} timestamp - タイムスタンプ（省略時は現在時刻）
   * @returns {Promise<string>} - 生成されたタイトル
   */
  async generateTitle(userId, timestamp = new Date()) {
    const { dateYmd, HH, MM } = getUtcDateParts(timestamp);
    const counter = await incrementDailyCounter(this.pool, userId, dateYmd);
    
    return `${dateYmd}-${HH}-${MM}-#${counter}`;
  }

  /**
   * タイトルをパース
   * @param {string} title - タイトル
   * @returns {{date: string, time: string, counter: number}|null}
   */
  parseTitle(title) {
    const regex = /^(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-#(\d+)$/;
    const match = title.match(regex);
    
    if (!match) {
      return null;
    }
    
    return {
      date: match[1],
      time: `${match[2]}:${match[3]}`,
      counter: parseInt(match[4], 10)
    };
  }
}
