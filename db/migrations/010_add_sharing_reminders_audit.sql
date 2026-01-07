-- 共有リンクテーブル
CREATE TABLE IF NOT EXISTS shared_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_id INT NOT NULL,
  user_id INT NOT NULL,
  public_id CHAR(26) NOT NULL UNIQUE,
  access_token VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  expires_at DATETIME,
  max_views INT,
  view_count INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_access_token (access_token),
  INDEX idx_user (user_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- リマインダーテーブル
CREATE TABLE IF NOT EXISTS reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action_item_id INT,
  entry_id INT,
  public_id CHAR(26) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  reminder_time DATETIME NOT NULL,
  notification_type ENUM('email', 'push', 'both') DEFAULT 'email',
  status ENUM('pending', 'sent', 'failed', 'cancelled') DEFAULT 'pending',
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  INDEX idx_user_time (user_id, reminder_time),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 監査ログテーブル
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 全文検索インデックス
ALTER TABLE entries ADD FULLTEXT INDEX idx_fulltext (title, transcript_text, summary_text);

-- エンベディングテーブル（セマンティック検索用）
CREATE TABLE IF NOT EXISTS entry_embeddings (
  entry_id INT PRIMARY KEY,
  embedding JSON NOT NULL,
  model_version VARCHAR(50) DEFAULT 'text-embedding-3-small',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
