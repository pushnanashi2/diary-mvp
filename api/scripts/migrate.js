#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 環境変数から接続情報を取得
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/diary_test_db';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    console.log('Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

    // マイグレーションディレクトリのパス
    const migrationsDir = path.join(__dirname, '../../db/migrations');
    
    // マイグレーションディレクトリが存在するか確認
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found. Creating tables manually...');
      await createBasicTables();
      console.log('✅ Basic tables created successfully');
      return;
    }

    // マイグレーションファイルを読み込む
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found. Creating basic tables...');
      await createBasicTables();
      console.log('✅ Basic tables created successfully');
      return;
    }

    console.log(`Found ${files.length} migration files`);

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await pool.query(sql);
        console.log(`✅ ${file} completed`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${file} already applied`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function createBasicTables() {
  // 基本的なテーブル構造を作成
  const basicSchema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(26) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Entries table
    CREATE TABLE IF NOT EXISTS entries (
      id VARCHAR(26) PRIMARY KEY,
      user_id VARCHAR(26) REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      mood VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
  `;

  await pool.query(basicSchema);
}

// スクリプトとして実行された場合
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
