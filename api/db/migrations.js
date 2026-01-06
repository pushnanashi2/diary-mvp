/**
 * データベースマイグレーション
 */

import { addColumnIfMissing } from '../config/database.js';
import { getS3Bucket, createMinioClient } from '../config/storage.js';

export async function runMigrations(pool) {
  // usersテーブル作成
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
  
  await addColumnIfMissing(
    pool,
    'users',
    'default_summary_template',
    "ALTER TABLE users ADD COLUMN default_summary_template VARCHAR(32) NOT NULL DEFAULT 'default'"
  );

  // entriesテーブル作成
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      title VARCHAR(64) NOT NULL,
      audio_url TEXT NOT NULL,
      transcript_text MEDIUMTEXT NULL,
      summary_text MEDIUMTEXT NULL,
      UNIQUE KEY uq_user_title (user_id, title),
      INDEX idx_user_created (user_id, created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);
  
  await addColumnIfMissing(
    pool,
    'entries',
    'pii_detected',
    'ALTER TABLE entries ADD COLUMN pii_detected TINYINT NOT NULL DEFAULT 0'
  );
  
  await addColumnIfMissing(
    pool,
    'entries',
    'pii_types',
    'ALTER TABLE entries ADD COLUMN pii_types TEXT NULL'
  );
  
  await addColumnIfMissing(
    pool,
    'entries',
    'pii_acknowledged',
    'ALTER TABLE entries ADD COLUMN pii_acknowledged TINYINT NOT NULL DEFAULT 0'
  );

  // daily_countersテーブル作成
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_counters (
      user_id BIGINT NOT NULL,
      date_ymd CHAR(10) NOT NULL,
      counter INT NOT NULL,
      PRIMARY KEY (user_id, date_ymd),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // summariesテーブル作成
  await pool.query(`
    CREATE TABLE IF NOT EXISTS summaries (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      range_start DATETIME NOT NULL,
      range_end DATETIME NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'queued',
      summary_text MEDIUMTEXT NULL,
      error_code VARCHAR(64) NULL,
      error_message VARCHAR(255) NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_range (user_id, range_start, range_end),
      INDEX idx_user_status (user_id, status, created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await addColumnIfMissing(
    pool,
    'summaries',
    'template_id',
    "ALTER TABLE summaries ADD COLUMN template_id VARCHAR(32) NOT NULL DEFAULT 'default'"
  );
  
  await addColumnIfMissing(
    pool,
    'summaries',
    'status',
    "ALTER TABLE summaries ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'queued'"
  );
  
  await addColumnIfMissing(
    pool,
    'summaries',
    'error_code',
    'ALTER TABLE summaries ADD COLUMN error_code VARCHAR(64) NULL'
  );
  
  await addColumnIfMissing(
    pool,
    'summaries',
    'error_message',
    'ALTER TABLE summaries ADD COLUMN error_message VARCHAR(255) NULL'
  );
  
  await addColumnIfMissing(
    pool,
    'summaries',
    'started_at',
    'ALTER TABLE summaries ADD COLUMN started_at DATETIME NULL'
  );
  
  await addColumnIfMissing(
    pool,
    'summaries',
    'finished_at',
    'ALTER TABLE summaries ADD COLUMN finished_at DATETIME NULL'
  );

  // MinIOバケット作成
  const minio = createMinioClient();
  const bucket = getS3Bucket();
  const exists = await minio.bucketExists(bucket).catch(() => false);
  
  if (!exists) {
    await minio.makeBucket(bucket);
  }
}
