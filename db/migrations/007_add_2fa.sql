-- Phase 4.2: 2段階認証（2FA）機能
-- users テーブルに2FA関連カラム追加

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(64) DEFAULT NULL COMMENT 'TOTP シークレット（暗号化推奨）',
ADD COLUMN IF NOT EXISTS two_factor_enabled TINYINT(1) DEFAULT 0 COMMENT '2FA有効フラグ（0=無効、1=有効）',
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT DEFAULT NULL COMMENT 'バックアップコード（JSON配列、暗号化推奨）',
ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMP NULL DEFAULT NULL COMMENT '2FA有効化日時';

-- インデックス追加（2FA有効ユーザーの検索用）
ALTER TABLE users 
ADD INDEX IF NOT EXISTS idx_two_factor_enabled (two_factor_enabled);
