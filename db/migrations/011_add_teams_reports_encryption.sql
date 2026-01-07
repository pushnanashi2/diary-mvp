-- チーム・グループ機能
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  owner_id VARCHAR(26) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  user_id VARCHAR(26) NOT NULL,
  role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_team_user (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 定期レポート設定
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL,
  public_id CHAR(26) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  frequency ENUM('daily', 'weekly', 'monthly') NOT NULL,
  day_of_week INT,
  day_of_month INT,
  time_of_day TIME DEFAULT '09:00:00',
  report_type ENUM('summary', 'analytics', 'action_items', 'custom') DEFAULT 'summary',
  delivery_method ENUM('email', 'slack', 'both') DEFAULT 'email',
  is_active TINYINT(1) DEFAULT 1,
  last_sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_active (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 暗号化キー管理
CREATE TABLE IF NOT EXISTS encryption_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL,
  key_id VARCHAR(100) NOT NULL UNIQUE,
  encrypted_key TEXT NOT NULL,
  algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AIチャット履歴
CREATE TABLE IF NOT EXISTS chat_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL,
  public_id CHAR(26) NOT NULL UNIQUE,
  title VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  INDEX idx_conversation (conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- コーチングセッション
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL,
  public_id CHAR(26) NOT NULL UNIQUE,
  session_type ENUM('goal_setting', 'reflection', 'habit_tracking', 'progress_review') NOT NULL,
  status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
  scheduled_at DATETIME,
  completed_at DATETIME,
  notes TEXT,
  insights JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
