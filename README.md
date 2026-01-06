# 📱 音声AI日記アプリ

音声で話すだけで日記が完成し、振り返り（要約）ができる日記アプリのMVP（Minimum Viable Product）です。

## ✨ 主な機能

- 🎤 **音声アップロード**: 音声ファイルをアップロードして日記を作成
- 📝 **自動文字起こし**: OpenAI Whisper APIによる高精度な音声認識
- 🤖 **AI要約**: GPTによる自動要約生成
- 🔒 **プライバシー保護**: 
  - PII（個人識別情報）の自動検出とマスキング
  - 電話番号・メールアドレスを含む日記は要約対象外
- 📊 **期間要約**: 複数の日記をまとめて振り返り
- 🎨 **テンプレート**: デフォルト・箇条書きなど複数の要約スタイル

## 🏗️ システム構成

Docker Composeで以下の5つのサービスを構成：

- **app-api** (Node.js/Express): REST API、認証、ファイル管理
- **worker** (Python): STT、テキスト処理、AI要約
- **mysql**: データベース
- **redis**: ジョブキュー
- **minio**: 音声ファイルストレージ

## 📐 アーキテクチャ（リファクタリング後）

```
api/
  ├── config/          # 設定ファイル
  │   ├── secrets.js   # 秘密情報読み込み
  │   ├── database.js  # DB接続設定
  │   ├── storage.js   # MinIO設定
  │   └── redis.js     # Redis接続
  ├── queries/         # SQLクエリ
  │   ├── userQueries.js
  │   ├── entryQueries.js
  │   ├── summaryQueries.js
  │   └── dailyCounterQueries.js
  ├── middleware/      # ミドルウェア
  │   ├── auth.js      # JWT認証
  │   └── rateLimit.js # レート制限
  ├── utils/           # ユーティリティ
  │   ├── audioUtils.js
  │   ├── dateUtils.js
  │   └── validation.js
  ├── db/              # データベース
  │   └── migrations.js
  └── server.js        # メインサーバー

.secrets/              # 秘密情報（Git除外）
  ├── openai.key       # OpenAI APIキー
  ├── jwt.secret       # JWT署名用シークレット
  └── db.creds         # DB認証情報
```

## 🚀 セットアップ

### 前提条件

- Docker & Docker Compose
- OpenAI API キー

### 1. リポジトリのクローン

```bash
git clone <your-repo-url>
cd diary-mvp
```

### 2. 秘密情報の設定

```bash
# サンプルファイルをコピー
cp .secrets/openai.key.example .secrets/openai.key
cp .secrets/jwt.secret.example .secrets/jwt.secret
cp .secrets/db.creds.example .secrets/db.creds

# 各ファイルを編集して実際の値を設定
# openai.key: OpenAI APIキーを記入
# jwt.secret: ランダムな長い文字列を記入（32文字以上推奨）
# db.creds: データベース認証情報をJSON形式で記入
```

**または従来の環境変数方式（.env）を使用:**

```bash
cp api/.env.example api/.env
cp worker/.env.example worker/.env

# 各.envファイルを編集して必要な情報を設定
```

### 3. 起動

```bash
docker compose up -d
```

### 4. 動作確認

```bash
curl http://localhost:8000/health
```

## 📚 API仕様

### 主要エンドポイント

- **POST /auth/register** - ユーザー登録
- **POST /auth/login** - ログイン
- **POST /entries** - 日記エントリ作成
- **GET /entries** - エントリ一覧取得
- **POST /summaries** - 期間要約作成
- **GET /summaries/:id** - 要約取得

詳細は[Notionドキュメント](https://www.notion.so/06-API-2e0c742b052381578cd9f027ee91f469)を参照してください。

## 🔒 セキュリティ

- **JWT認証**: Bearer token方式
- **PII自動検出・マスキング**: 電話番号・メールアドレスの保護
- **レート制限**: API乱用防止
- **音声ファイルの署名付きURL**: 期限付きアクセス制御
- **秘密情報の分離管理**: `.secrets/`ディレクトリで集中管理

### 秘密情報管理

このプロジェクトでは、以下のルールで秘密情報を管理しています:

- ✅ `.secrets/`ディレクトリで秘密情報を集中管理
- ✅ `.gitignore`で自動除外
- ✅ サンプルファイル（.example）のみGit管理
- ❌ APIキー・トークン・パスワードは**絶対にGitにコミットしない**

## 📝 開発状況

### 完了済み（✅）
- MVP基本機能実装完了
- コーディング規約作成
- **リファクタリング完了**:
  - ✅ SQL文とJSロジックの完全分離
  - ✅ 秘密情報管理の強化（.secrets/化）
  - ✅ 設定ファイルの分離
  - ✅ ミドルウェア・ユーティリティの分離

### 次の優先タスク
- [ ] public_id化（外部ID連番問題の解決）
- [ ] タイトル採番#0問題の調査
- [ ] 共有禁止の厳密化（Bearer必須方式）

## 📖 ドキュメント

完全な開発ドキュメントはNotionで管理しています:
- [📘 音声AI日記アプリ - 開発ドキュメント](https://www.notion.so/AI-2e0c742b0523815a904de4b309dc9a18)
- [📐 コーディング規約](https://www.notion.so/11-2e0c742b05238173901ae9bbd667f4aa)

## 🎯 コーディング規約

このプロジェクトでは[コーディング規約](https://www.notion.so/11-2e0c742b05238173901ae9bbd667f4aa)に従って開発しています。

主要な原則:
- **SQL分離**: クエリは`api/queries/`に集約
- **秘密情報分離**: `.secrets/`で管理、環境変数への依存を最小化
- **命名規則**: JavaScript=camelCase、Python=snake_case
- **非同期処理**: async/awaitを使用
- **コメント**: 複雑なロジックには必ず説明を記載

## 📄 ライセンス

非公開
