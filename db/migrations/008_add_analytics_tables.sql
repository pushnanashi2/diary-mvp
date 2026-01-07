-- Phase 4.4-4.6: 感情分析・キーワード抽出・話し方分析用テーブル

-- 感情分析結果テーブル
CREATE TABLE IF NOT EXISTS entry_emotions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entry_id INT NOT NULL,
  joy FLOAT DEFAULT 0 COMMENT '喜び (0-1)',
  sadness FLOAT DEFAULT 0 COMMENT '悲しみ (0-1)',
  anger FLOAT DEFAULT 0 COMMENT '怒り (0-1)',
  fear FLOAT DEFAULT 0 COMMENT '恐れ (0-1)',
  surprise FLOAT DEFAULT 0 COMMENT '驚き (0-1)',
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  UNIQUE KEY unique_entry_emotion (entry_id),
  INDEX idx_entry_id (entry_id),
  INDEX idx_joy (joy),
  INDEX idx_analyzed_at (analyzed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- キーワード抽出結果テーブル
CREATE TABLE IF NOT EXISTS entry_keywords (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entry_id INT NOT NULL,
  keyword VARCHAR(100) NOT NULL,
  score FLOAT DEFAULT 0 COMMENT '重要度スコア (0-1)',
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  INDEX idx_entry_id (entry_id),
  INDEX idx_keyword (keyword),
  INDEX idx_score (score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- トピックテーブル
CREATE TABLE IF NOT EXISTS topics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- エントリ-トピック関連テーブル
CREATE TABLE IF NOT EXISTS entry_topics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entry_id INT NOT NULL,
  topic_id INT NOT NULL,
  relevance_score FLOAT DEFAULT 0 COMMENT '関連度 (0-1)',
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  UNIQUE KEY unique_entry_topic (entry_id, topic_id),
  INDEX idx_entry_id (entry_id),
  INDEX idx_topic_id (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 話し方分析結果テーブル
CREATE TABLE IF NOT EXISTS entry_speech_analysis (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entry_id INT NOT NULL,
  speech_rate FLOAT DEFAULT 0 COMMENT '話す速度 (words/min)',
  filler_word_rate FLOAT DEFAULT 0 COMMENT 'フィラーワード出現率 (0-1)',
  avg_sentence_length FLOAT DEFAULT 0 COMMENT '文の平均長さ (文字数)',
  vocabulary_diversity FLOAT DEFAULT 0 COMMENT '語彙多様性 TTR (0-1)',
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  UNIQUE KEY unique_entry_speech (entry_id),
  INDEX idx_entry_id (entry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- アクションアイテムテーブル
CREATE TABLE IF NOT EXISTS action_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entry_id INT NOT NULL,
  action TEXT NOT NULL,
  deadline DATE,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  INDEX idx_entry_id (entry_id),
  INDEX idx_status (status),
  INDEX idx_deadline (deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;