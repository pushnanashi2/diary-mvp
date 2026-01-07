# Diary MVP - AI-Powered Voice Diary Application

![Tests](https://github.com/pushnanashi2/diary-mvp/workflows/Test%20Suite/badge.svg)
![Coverage](https://img.shields.io/codecov/c/github/pushnanashi2/diary-mvp)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

高度なAI機能を備えた音声日記アプリケーション

## 🎯 プロジェクトステータス

| Phase | ステータス | カバレッジ | テスト数 | 完了日 |
|-------|----------|----------|---------|--------|
| Phase 1-3 | ✅ 完了 | - | - | 2026-01-05 |
| Phase 4 | ✅ 完了 | - | 37機能 | 2026-01-07 |
| Phase 5 | ✅ 完了 | - | リファクタ | 2026-01-07 |
| Phase 6 | ✅ 完了 | 70% | 90 | 2026-01-07 |
| **Phase 7** | **✅ 完了** | **92.7%** | **237** | **2026-01-07** |

## 🚀 主要機能

### コア機能
- 🎤 音声日記の録音・文字起こし (Whisper API)
- 📝 テキスト日記の作成・編集
- 🔐 Bearer認証 + 2FA
- 🌐 多言語対応 (英語・日本語)

### AI分析機能
- 😊 感情分析 (11種類の感情 + 強度)
- 🔑 キーワード抽出 (関連性スコア付き)
- 📋 アクションアイテム抽出 (優先度・期限)
- 📊 週次・月次サマリー生成

### コラボレーション
- 👥 チーム管理 (ロールベース権限)
- 🔗 共有リンク (有効期限・コメント機能)
- 📧 定期レポート (Email/PDF)

### 検索・分析
- 🔍 全文検索 + セマンティック検索
- 📈 感情トレンド分析
- 📉 キーワード頻度分析
- 🎯 目標達成トラッキング

### インタラクティブ機能
- 💬 AIチャットボット (コンテキスト対応)
- 🧑‍🏫 AIコーチング (8つのトピック)
- ⏰ スマートリマインダー (繰り返し対応)
- 🔔 リアルタイム通知 (WebSocket)

### セキュリティ・監査
- 📜 完全な監査ログ
- 🔒 E2E暗号化対応
- 🛡️ レート制限
- 🔐 ULID ベース公開ID

## 📊 テストカバレッジ (Phase 7)

### カバレッジサマリー
- **総合カバレッジ**: 92.7%
- **総テスト数**: 237
- **実行時間**: 12分45秒

### 詳細内訳

| レイヤー | カバレッジ | テスト数 | 主要テスト |
|---------|----------|---------|----------|
| **API層** | 93.2% | 133 | Auth, Entries, Summaries, Search, Teams, Reports, Coaching, Chat, Reminders, Audit |
| **Worker層** | 92.2% | 49 | Emotion, Keywords, Speech, Actions |
| **Utils** | 92.7% | 55 | Validators, Logger, ErrorHandler, EdgeCases, Performance |

### テスト種別
- ✅ ユニットテスト: 70
- ✅ 統合テスト: 110
- ✅ E2Eテスト: 35
- ✅ エッジケース: 15
- ✅ パフォーマンス: 7

## 🛠️ 技術スタック

### バックエンド
- **API**: Node.js + Express.js
- **Worker**: Python 3.11
- **データベース**: PostgreSQL 15
- **キャッシュ**: Redis 7

### AI/ML
- **OpenAI GPT-4**: 感情分析、要約、チャット
- **Whisper API**: 音声文字起こし
- **Embeddings**: セマンティック検索

### インフラ
- **コンテナ**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **テスト**: Jest (API) + Pytest (Worker)
- **カバレッジ**: Codecov

## 🚀 セットアップ

### 必要要件
- Docker & Docker Compose
- Node.js 18+ (開発時)
- Python 3.11+ (開発時)

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/pushnanashi2/diary-mvp.git
cd diary-mvp

# 環境変数設定
cp .env.example .env
# .envファイルを編集し、OPENAI_API_KEYなどを設定

# Docker Composeで起動
docker-compose up --build

# マイグレーション実行
docker-compose exec api npm run migrate
```

### 開発環境

```bash
# API開発
cd api
npm install
npm run dev

# Worker開発
cd worker
pip install -r requirements.txt
python main.py
```

## 🧪 テスト

### すべてのテスト実行

```bash
# APIテスト
npm test
npm run test:coverage

# Workerテスト
cd worker
pytest
pytest --cov=app --cov-report=html
```

### カテゴリ別実行

```bash
# ユニットテスト
npm run test:unit

# 統合テスト
npm run test:integration

# E2Eテスト
npm run test:e2e

# ウォッチモード
npm run test:watch
```

### CI/CD

```bash
# GitHub Actions で自動実行
# - push/PR時に全テスト実行
# - カバレッジレポート自動生成
# - Codecovへアップロード
```

## 📖 API ドキュメント

### 認証
```http
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/2fa/setup
POST /api/auth/2fa/verify
GET  /api/auth/me
```

### エントリー
```http
GET    /api/entries
POST   /api/entries
GET    /api/entries/:id
PUT    /api/entries/:id
DELETE /api/entries/:id
POST   /api/entries/:id/audio
```

### 分析
```http
GET /api/analytics/emotions/trend
GET /api/analytics/keywords/frequency
GET /api/analytics/summary
GET /api/action-items
POST /api/action-items/:id/complete
```

### AI機能
```http
POST /api/chat/conversations
POST /api/chat/conversations/:id/messages
POST /api/coaching/sessions
POST /api/coaching/sessions/:id/messages
```

### 検索
```http
GET /api/search/fulltext?q=query
GET /api/search/semantic?q=query
GET /api/search/advanced
```

詳細は [API Documentation](docs/API.md) を参照

## 📂 プロジェクト構造

```
diary-mvp/
├── api/                    # Node.js API サーバー
│   ├── config/            # 設定ファイル
│   ├── middleware/        # ミドルウェア
│   ├── routes/            # APIルート
│   ├── services/          # ビジネスロジック
│   ├── queries/           # データベースクエリ
│   └── utils/             # ユーティリティ
├── worker/                 # Python Worker
│   ├── app/               # Workerロジック
│   │   ├── base_processor.py
│   │   ├── emotion_analyzer.py
│   │   ├── keyword_extractor.py
│   │   ├── speech_processor.py
│   │   └── action_extractor.py
│   └── tests/             # Workerテスト
├── db/
│   └── migrations/        # DBマイグレーション
├── tests/                  # APIテスト
│   ├── api/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   └── setup.js
├── docs/                   # ドキュメント
│   ├── PHASE4_COMPLETE.md
│   ├── PHASE5_REFACTORING.md
│   ├── PHASE6_TESTING_COMPLETE.md
│   ├── PHASE7_100_COVERAGE.md
│   └── TESTING_GUIDE.md
├── .github/
│   └── workflows/         # GitHub Actions
├── docker-compose.yml
├── package.json
└── README.md
```

## 🔒 セキュリティ

### 実装済み
- ✅ Bearer Token 認証
- ✅ 2要素認証 (TOTP)
- ✅ bcrypt パスワードハッシュ
- ✅ ULID ベース公開ID
- ✅ レート制限
- ✅ CORS設定
- ✅ Helmet.js セキュリティヘッダー
- ✅ SQL インジェクション防止
- ✅ XSS 防止
- ✅ 監査ログ

### 今後の実装
- ⬜ E2E暗号化 (計画済み)
- ⬜ OAuth2対応
- ⬜ セキュリティスキャン統合

## 📈 パフォーマンス

### 最適化
- Redis キャッシュ (5分TTL)
- データベース接続プール (max: 10)
- インデックス最適化
- Worker並列処理

### ベンチマーク
- エントリー取得: < 500ms
- 検索: < 2s
- AI分析: < 5s
- 音声文字起こし: ~10s (1分音声)

## 🤝 コントリビューション

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### コーディング規約
- ESLint (API)
- Black + Flake8 (Worker)
- 92%+ テストカバレッジ維持

## 📝 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照

## 📞 サポート

- 📧 Email: support@diary-mvp.com
- 📚 Documentation: [docs/](docs/)
- 🐛 Issues: [GitHub Issues](https://github.com/pushnanashi2/diary-mvp/issues)

## 🎉 謝辞

- OpenAI (GPT-4, Whisper API)
- PostgreSQL チーム
- Redis チーム
- すべてのコントリビューター

---

**開発者**: PushNaNaShi  
**最終更新**: 2026-01-07  
**バージョン**: 2.0.0  
**ステータス**: 本番デプロイ準備完了 🚀
