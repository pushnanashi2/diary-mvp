-- 005_add_tags.sql
-- タグ機能追加（Phase2-2）

-- entry_tags テーブル作成
CREATE TABLE IF NOT EXISTS entry_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_id INT NOT NULL,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  UNIQUE KEY unique_entry_tag (entry_id, tag),
  INDEX idx_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
