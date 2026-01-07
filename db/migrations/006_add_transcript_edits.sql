-- Phase 4.1: 文字起こし手動編集機能
-- transcript_edits テーブル作成

CREATE TABLE IF NOT EXISTS transcript_edits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entry_id INT NOT NULL,
  edited_text TEXT NOT NULL,
  edited_by INT NOT NULL,
  edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INT NOT NULL DEFAULT 1,
  edit_note VARCHAR(500),
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_entry_id (entry_id),
  INDEX idx_edited_at (edited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- entries テーブルに current_transcript_version 列追加
ALTER TABLE entries 
ADD COLUMN IF NOT EXISTS current_transcript_version INT DEFAULT 0 COMMENT '現在の文字起こしバージョン（0=オリジナル、1以上=編集版）';
