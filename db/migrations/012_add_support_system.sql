-- ============================================================
-- Support Chat & Feedback System
-- ユーザー問い合わせチャットボット + 管理者フィードバック機能
-- ============================================================

-- サポートチャット会話テーブル
CREATE TABLE IF NOT EXISTS support_conversations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(26) UNIQUE NOT NULL,
  user_id BIGINT,
  session_id VARCHAR(64) NOT NULL, -- 未ログインユーザー用
  email VARCHAR(255), -- 未ログインユーザーのメールアドレス
  status ENUM('open', 'waiting', 'resolved', 'closed') DEFAULT 'open',
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  category VARCHAR(50), -- 'technical', 'billing', 'general', etc.
  first_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  assigned_admin_id BIGINT, -- 担当管理者
  
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- サポートチャットメッセージテーブル
CREATE TABLE IF NOT EXISTS support_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_type ENUM('user', 'bot', 'admin') NOT NULL,
  sender_id BIGINT, -- user_id または admin_id
  message TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3,2), -- 0.00 - 1.00
  metadata JSON, -- 添付ファイル、フォーマット情報など
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (conversation_id) REFERENCES support_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理者フィードバックテーブル
CREATE TABLE IF NOT EXISTS admin_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  admin_id BIGINT NOT NULL,
  feedback_type ENUM('rating', 'escalation', 'resolution', 'note') NOT NULL,
  rating INT, -- 1-5 (ユーザー対応の評価)
  notes TEXT,
  action_taken VARCHAR(255), -- 'escalated_to_dev', 'refunded', 'manual_fix', etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_admin_id (admin_id),
  FOREIGN KEY (conversation_id) REFERENCES support_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- サポート統計テーブル
CREATE TABLE IF NOT EXISTS support_stats (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  total_conversations INT DEFAULT 0,
  resolved_conversations INT DEFAULT 0,
  avg_response_time_seconds INT, -- 平均応答時間
  avg_resolution_time_seconds INT, -- 平均解決時間
  bot_handled_rate DECIMAL(5,2), -- ボットだけで解決した割合
  user_satisfaction_avg DECIMAL(3,2), -- 平均満足度
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- サポートボット知識ベーステーブル
CREATE TABLE IF NOT EXISTS support_kb_articles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(26) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50),
  keywords TEXT, -- カンマ区切り
  usage_count INT DEFAULT 0, -- 参照された回数
  effectiveness_score DECIMAL(3,2), -- 0.00 - 1.00 (問題解決率)
  created_by BIGINT, -- 作成した管理者
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_category (category),
  INDEX idx_usage_count (usage_count),
  FULLTEXT idx_content_search (title, content, keywords)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理者テーブル（既存の users とは別管理）
CREATE TABLE IF NOT EXISTS admins (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role ENUM('support', 'manager', 'admin') DEFAULT 'support',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理者通知テーブル
CREATE TABLE IF NOT EXISTS admin_notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id BIGINT,
  notification_type ENUM('new_conversation', 'escalation', 'high_priority', 'unresolved_24h') NOT NULL,
  conversation_id BIGINT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_admin_id (admin_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY (conversation_id) REFERENCES support_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
