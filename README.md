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

## 🚀 セットアップ

### 前提条件

- Docker & Docker Compose
- OpenAI API キー

### 1. リポジトリのクローン

git clone <your-repo-url>
cd diary-mvp

### 2. 環境変数の設定

cp api/.env.example api/.env
cp worker/.env.example worker/.env

各.envファイルを編集して必要な情報を設定：
- JWT_SECRET: ランダムな文字列
- MYSQL_PASSWORD: データベースパスワード
- OPENAI_API_KEY: OpenAI APIキー

### 3. 起動

docker compose up -d

### 4. 動作確認

curl http://localhost:3000/health

## 📚 API仕様

### 主要エンドポイント

- POST /auth/register - ユーザー登録
- POST /auth/login - ログイン
- POST /entries - 日記エントリ作成
- GET /entries - エントリ一覧取得
- POST /summaries - 期間要約作成
- GET /summaries/:id - 要約取得

## 🔒 セキュリティ

- JWT認証
- PII自動検出・マスキング
- レート制限
- 音声ファイルの署名付きURL

## 📝 開発状況

現在MVPフェーズ。次の優先タスク：

- [ ] public_id化
- [ ] 音声共有禁止の厳密化
- [ ] タグ辞書機能
- [ ] STTローカル化

## 📄 ライセンス

非公開
