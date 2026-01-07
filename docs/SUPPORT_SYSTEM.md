# 🤖 サポートチャットボット & 管理者フィードバックシステム

## 📋 概要

ユーザー向けの問い合わせチャットボットと、管理者による問い合わせ管理機能を提供します。

---

## 🎯 主要機能

### ユーザー向け機能

1. **チャットボット問い合わせ**
   - ✅ 未ログインユーザーも利用可能
   - ✅ AI 自動応答
   - ✅ カテゴリ別対応（技術/請求/一般）
   - ✅ 会話履歴の保存

2. **リアルタイムサポート**
   - ✅ 管理者への自動エスカレーション
   - ✅ 優先度設定
   - ✅ 解決済みマーク

### 管理者向け機能

1. **問い合わせ管理ダッシュボード**
   - ✅ 全会話の一覧表示
   - ✅ ステータス/優先度フィルター
   - ✅ 担当管理者割り当て

2. **フィードバックシステム**
   - ✅ 会話の評価（1-5段階）
   - ✅ 対応履歴の記録
   - ✅ アクション追跡

3. **統計ダッシュボード**
   - ✅ 解決率
   - ✅ 平均応答時間
   - ✅ ユーザー満足度

---

## 🔧 API エンドポイント

### ユーザー API

#### 1. 新しい会話を開始

```http
POST /api/support/conversations
Content-Type: application/json
Authorization: Bearer <token> (オプション)

{
  "message": "音声アップロードができません",
  "email": "user@example.com",  // 未ログイン時は必須
  "category": "technical"        // technical, billing, general
}
```

**Response:**
```json
{
  "conversation": {
    "public_id": "01HQXXX...",
    "status": "open",
    "category": "technical"
  },
  "bot_response": "ご質問ありがとうございます。技術的な問題についてサポートいたします..."
}
```

#### 2. 会話の詳細を取得

```http
GET /api/support/conversations/:public_id
Authorization: Bearer <token> (オプション)
```

**Response:**
```json
{
  "conversation": {
    "public_id": "01HQXXX...",
    "status": "open",
    "category": "technical",
    "created_at": "2026-01-07T10:00:00Z"
  },
  "messages": [
    {
      "id": 1,
      "sender_type": "user",
      "message": "音声アップロードができません",
      "created_at": "2026-01-07T10:00:00Z"
    },
    {
      "id": 2,
      "sender_type": "bot",
      "message": "ご質問ありがとうございます...",
      "is_ai_generated": true,
      "created_at": "2026-01-07T10:00:01Z"
    }
  ]
}
```

#### 3. メッセージを追加

```http
POST /api/support/conversations/:public_id/messages
Content-Type: application/json

{
  "message": "Chrome ブラウザで発生しています"
}
```

#### 4. 会話を解決済みにする

```http
POST /api/support/conversations/:public_id/resolve
Content-Type: application/json

{
  "rating": 5  // 1-5 (満足度)
}
```

---

### 管理者 API

#### 1. 会話一覧を取得

```http
GET /api/admin/conversations?status=open&priority=urgent&page=1&limit=20
X-Admin-ID: 123
```

**Response:**
```json
{
  "conversations": [
    {
      "id": 1,
      "public_id": "01HQXXX...",
      "email": "user@example.com",
      "status": "open",
      "priority": "urgent",
      "category": "technical",
      "first_message": "音声アップロードができません",
      "message_count": 4,
      "created_at": "2026-01-07T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### 2. 会話の詳細を取得

```http
GET /api/admin/conversations/:id
X-Admin-ID: 123
```

#### 3. メッセージを送信

```http
POST /api/admin/conversations/:id/messages
X-Admin-ID: 123
Content-Type: application/json

{
  "message": "ご連絡ありがとうございます。ブラウザのキャッシュをクリアしてみてください。"
}
```

#### 4. 会話を割り当て

```http
PUT /api/admin/conversations/:id/assign
X-Admin-ID: 123
Content-Type: application/json

{
  "admin_id": 456  // 割り当て先の管理者ID
}
```

#### 5. ステータスを更新

```http
PUT /api/admin/conversations/:id/status
X-Admin-ID: 123
Content-Type: application/json

{
  "status": "resolved"  // open, waiting, resolved, closed
}
```

#### 6. フィードバックを追加

```http
POST /api/admin/conversations/:id/feedback
X-Admin-ID: 123
Content-Type: application/json

{
  "feedback_type": "resolution",
  "rating": 4,
  "notes": "ブラウザキャッシュの問題でした",
  "action_taken": "manual_fix"
}
```

#### 7. 統計を取得

```http
GET /api/admin/stats?start_date=2026-01-01&end_date=2026-01-31
X-Admin-ID: 123
```

**Response:**
```json
{
  "basic_stats": {
    "total_conversations": 500,
    "resolved_count": 450,
    "open_count": 50,
    "urgent_count": 10,
    "avg_resolution_time": 3600
  },
  "daily_stats": [
    {
      "date": "2026-01-07",
      "total_conversations": 25,
      "resolved_conversations": 20,
      "avg_response_time_seconds": 120,
      "user_satisfaction_avg": 4.5
    }
  ]
}
```

#### 8. 通知を取得

```http
GET /api/admin/notifications?is_read=false
X-Admin-ID: 123
```

#### 9. 通知を既読にする

```http
PUT /api/admin/notifications/:id/read
X-Admin-ID: 123
```

---

## 📊 データベーススキーマ

### テーブル一覧

| テーブル名 | 説明 |
|-----------|------|
| `support_conversations` | サポート会話 |
| `support_messages` | チャットメッセージ |
| `admin_feedback` | 管理者フィードバック |
| `support_stats` | 日別統計 |
| `support_kb_articles` | 知識ベース |
| `admins` | 管理者アカウント |
| `admin_notifications` | 管理者通知 |

### 主要フィールド

**support_conversations:**
- `public_id`: 公開ID (ULID)
- `user_id`: ユーザーID (NULL可)
- `session_id`: セッションID
- `email`: メールアドレス
- `status`: ステータス (open/waiting/resolved/closed)
- `priority`: 優先度 (low/normal/high/urgent)
- `category`: カテゴリ

**support_messages:**
- `conversation_id`: 会話ID
- `sender_type`: 送信者タイプ (user/bot/admin)
- `message`: メッセージ本文
- `is_ai_generated`: AI生成フラグ
- `ai_confidence`: AI信頼度 (0.00-1.00)

---

## 🔐 セキュリティ

### 実装済み

- ✅ 未ログインユーザーのセッションID管理
- ✅ 管理者認証（ヘッダーベース）
- ✅ 会話の所有者確認
- ✅ SQL インジェクション対策

### 今後の実装予定

- ⬜ 管理者用 JWT 認証
- ⬜ RBAC（ロールベースアクセス制御）
- ⬜ レート制限
- ⬜ E2E 暗号化

---

## 🚀 セットアップ

### 1. マイグレーション実行

```bash
cd ~/diary-mvp
npm run migrate
```

### 2. 管理者アカウント作成

```sql
INSERT INTO admins (email, password_hash, name, role)
VALUES (
  'admin@example.com',
  '$2b$10$...', -- bcrypt ハッシュ
  'Admin User',
  'admin'
);
```

### 3. サーバー起動

```bash
npm run dev
```

---

## 📝 使用例

### ユーザーからの問い合わせフロー

1. **ユーザー**: 問い合わせを開始
   ```bash
   curl -X POST http://localhost:3000/api/support/conversations \
     -H "Content-Type: application/json" \
     -d '{"message": "ログインできません", "email": "user@example.com", "category": "technical"}'
   ```

2. **ボット**: 自動応答
   ```json
   {
     "bot_response": "ログインの問題ですね。パスワードを忘れた場合は..."
   }
   ```

3. **ユーザー**: 追加質問
   ```bash
   curl -X POST http://localhost:3000/api/support/conversations/01HQXXX.../messages \
     -H "Content-Type: application/json" \
     -d '{"message": "パスワードリセットメールが届きません"}'
   ```

4. **管理者**: 手動対応
   ```bash
   curl -X POST http://localhost:3000/api/admin/conversations/01HQXXX.../messages \
     -H "X-Admin-ID: 123" \
     -H "Content-Type: application/json" \
     -d '{"message": "メールアドレスを確認させていただけますか？"}'
   ```

5. **管理者**: 解決
   ```bash
   curl -X PUT http://localhost:3000/api/admin/conversations/01HQXXX.../status \
     -H "X-Admin-ID: 123" \
     -H "Content-Type: application/json" \
     -d '{"status": "resolved"}'
   ```

---

## 🎉 今後の機能拡張

- [ ] **OpenAI GPT-4 統合**: より高度な自動応答
- [ ] **WebSocket リアルタイム通信**: 管理者-ユーザー間のチャット
- [ ] **ファイル添付**: スクリーンショットの共有
- [ ] **多言語対応**: 英語・日本語自動切り替え
- [ ] **感情分析**: ユーザーの満足度をリアルタイム検出
- [ ] **SLA 管理**: 応答時間の自動追跡

---

**最終更新**: 2026-01-07  
**バージョン**: 1.0.0
