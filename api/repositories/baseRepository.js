/**
 * Base Repository
 * 共通データベース操作
 */

export class BaseRepository {
  constructor(pool, tableName) {
    this.pool = pool;
    this.tableName = tableName;
  }

  async findById(id) {
    const [rows] = await this.pool.query(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    return rows[0] || null;
  }

  async findByPublicId(publicId) {
    const [rows] = await this.pool.query(`SELECT * FROM ${this.tableName} WHERE public_id = ?`, [publicId]);
    return rows[0] || null;
  }

  async create(data) {
    const [result] = await this.pool.query(`INSERT INTO ${this.tableName} SET ?`, [data]);
    return result.insertId;
  }

  async update(id, data) {
    const [result] = await this.pool.query(`UPDATE ${this.tableName} SET ? WHERE id = ?`, [data, id]);
    return result.affectedRows;
  }

  async delete(id) {
    const [result] = await this.pool.query(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
    return result.affectedRows;
  }

  async findAll(conditions = {}, orderBy = 'id DESC', limit = null) {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];

    if (Object.keys(conditions).length > 0) {
      const whereClauses = Object.keys(conditions).map(key => `${key} = ?`);
      sql += ' WHERE ' + whereClauses.join(' AND ');
      params.push(...Object.values(conditions));
    }

    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;

    const [rows] = await this.pool.query(sql, params);
    return rows;
  }
}

export default BaseRepository;