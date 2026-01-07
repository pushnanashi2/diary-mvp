#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数から接続情報を取得
const DATABASE_URL = process.env.DATABASE_URL || 'mysql://diary:diary_password@127.0.0.1:3306/diary';

// MySQL URL をパース
function parseMySQLUrl(url) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    host: match[3],
    port: parseInt(match[4]),
    user: match[1],
    password: match[2],
    database: match[5]
  };
}

async function runMigrations() {
  let connection;
  try {
    console.log('Starting database migrations...');
    console.log('Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

    const config = parseMySQLUrl(DATABASE_URL);
    connection = await mysql.createConnection(config);

    console.log('✅ Connected to MySQL database');

    // マイグレーションディレクトリのパス
    const migrationsDir = path.join(__dirname, '../../db/migrations');
    
    // マイグレーションディレクトリが存在するか確認
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found. Creating tables manually...');
      await createBasicTables(connection);
      console.log('✅ Basic tables created successfully');
      return;
    }

    // マイグレーションファイルを読み込む
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found. Creating basic tables...');
      await createBasicTables(connection);
      console.log('✅ Basic tables created successfully');
      return;
    }

    console.log(`Found ${files.length} migration files`);

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split SQL by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      try {
        for (const statement of statements) {
          await connection.query(statement);
        }
        console.log(`✅ ${file} completed`);
      } catch (error) {
        if (error.message.includes('already exists') || error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠️  ${file} already applied`);
        } else {
          console.error(`Error in ${file}:`, error.message);
          throw error;
        }
      }
    }

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function createBasicTables(connection) {
  // 基本的なテーブル構造を作成
  const basicSchema = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(26) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS entries (
      id VARCHAR(26) PRIMARY KEY,
      user_id VARCHAR(26) NOT NULL,
      content TEXT NOT NULL,
      mood VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
  `;

  const statements = basicSchema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await connection.query(statement);
  }
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };
