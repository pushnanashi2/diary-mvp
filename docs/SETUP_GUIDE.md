# 🚀 Diary MVP - セットアップガイド

完全なローカル開発環境セットアップガイド

---

## 📋 前提条件

### 必須
- ✅ **Docker Desktop** (Windows/Mac) または Docker Engine (Linux)
- ✅ **Docker Compose** v2.0+
- ✅ **Node.js** 18+ および npm 9+
- ✅ **Python** 3.11+
- ✅ **OpenAI API キー** ([取得方法](https://platform.openai.com/api-keys))

### 推奨
- Git 2.30+
- VSCode または任意のIDE
- WSL2 (Windows環境の場合)

---

## 🎯 クイックスタート (5分)

### Step 1: リポジトリクローン

```bash
git clone https://github.com/pushnanashi2/diary-mvp.git
cd diary-mvp
```

### Step 2: 環境変数設定

```bash
# テンプレートをコピー
cp api/.env.example .env

# .env を編集（重要！）
# 最低限、以下を設定してください：
# - OPENAI_API_KEY=sk-proj-your-actual-key
# - JWT_SECRET=your-random-secret-key
```

**.env の例:**

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://diary:diary_password@127.0.0.1:3306/diary
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET_NAME=diary-audio
```

### Step 3: Docker Compose 起動

```bash
# すべてのサービスを起動
docker-compose up -d

# サービスが起動するまで待機
sleep 15

# ステータス確認
docker ps
```

**期待される出力:**
```
CONTAINER ID   IMAGE          STATUS                   PORTS
xxxxx          mysql:8.4      Up (healthy)             0.0.0.0:3306->3306/tcp
xxxxx          redis:7        Up (healthy)             0.0.0.0:6379->6379/tcp
xxxxx          minio/minio    Up                       0.0.0.0:9000-9001->9000-9001/tcp
```

### Step 4: データベースマイグレーション

```bash
# 依存関係インストール
npm install

# マイグレーション実行
npm run migrate
```

**期待される出力:**
```
✅ Connected to MySQL database
Found 6 migration files
Running migration: 006_add_transcript_edits.sql -> ✅ completed
...
✅ All migrations completed successfully
```

### Step 5: API サーバー起動

```bash
# 開発モードで起動
npm run dev
```

**期待される出力:**
```
[2026-01-07T14:30:00.000Z] [INFO] [DATABASE] Connection pool initialized successfully
[2026-01-07T14:30:00.000Z] [INFO] [REDIS] Connected
[2026-01-07T14:30:00.000Z] [INFO] [SERVER] Listening on port 3000
[2026-01-07T14:30:00.000Z] [INFO] [SERVER] Environment: development
```

### Step 6: 動作確認

**別のターミナルで:**

```bash
# ヘルスチェック
curl http://localhost:3000/health
# 期待: {"status":"ok"}

# ユーザー登録
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234",
    "name": "テストユーザー"
  }'
# 期待: {"user":{...}, "token":"eyJ..."}
```

---

## 🔧 詳細セットアップ

### Docker 構成

#### サービス一覧

| サービス | ポート | 説明 |
|---------|--------|------|
| MySQL | 3306 | メインデータベース |
| Redis | 6379 | キャッシュ・ジョブキュー |
| MinIO | 9000, 9001 | オブジェクトストレージ (音声ファイル) |
| API | 8000 | (Docker内での実行時) |
| Worker | - | バックグラウンド処理 |

#### ボリューム

- `mysqldata`: MySQL データ永続化
- `miniodata`: MinIO データ永続化

### WSL2 環境での注意点

Windows + WSL2 の場合:

```bash
# Docker Desktop の WSL2 統合を有効化
# Settings → Resources → WSL Integration → Ubuntu を ON

# WSL2 内で確認
docker --version
docker compose version

# ポート公開確認
docker ps | grep "0.0.0.0"
```

### トラブルシューティング

#### 問題: MySQL 接続エラー `ECONNREFUSED 127.0.0.1:3306`

**原因**: MySQL ポートが公開されていない

**解決策**:
```bash
# docker-compose.yml の mysql セクションに ports を追加
mysql:
  ports:
    - "3306:3306"

# 再起動
docker-compose down
docker-compose up -d
```

#### 問題: Redis 接続エラー

**原因**: Redis ポートが公開されていない

**解決策**:
```bash
# docker-compose.yml の redis セクションに ports を追加
redis:
  ports:
    - "6379:6379"

# 再起動
docker-compose down
docker-compose up -d
```

#### 問題: `.env` が読み込まれない

**原因**: dotenv の設定ミス

**確認**:
```bash
# .env の場所確認
ls -la .env

# 環境変数確認
node -e "import('dotenv').then(dotenv => {
  dotenv.config({ path: '.env' });
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
});"
```

---

## 🧪 テスト環境セットアップ

### API テスト

```bash
# すべてのテスト
npm test

# カバレッジ付き
npm run test:coverage

# ウォッチモード
npm run test:watch

# カテゴリ別
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Worker テスト

```bash
cd worker

# Python 環境セットアップ
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係インストール
pip install -r requirements.txt

# テスト実行
pytest
pytest --cov=app --cov-report=html

# カバレッジレポート確認
open htmlcov/index.html  # Mac
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

---

## 📊 開発ツール

### データベース管理

#### MySQL CLI

```bash
# Docker 内の MySQL に接続
docker exec -it diary-mvp-mysql-1 mysql -u diary -pdiary_password diary

# テーブル一覧
SHOW TABLES;

# ユーザー確認
SELECT * FROM users;
```

#### Redis CLI

```bash
# Docker 内の Redis に接続
docker exec -it diary-mvp-redis-1 redis-cli

# キー一覧
KEYS *

# キャッシュ確認
GET some-key
```

#### MinIO Console

ブラウザで http://localhost:9001 にアクセス

- **ユーザー名**: `minioadmin`
- **パスワード**: `minioadmin`

### ログ確認

```bash
# API ログ
npm run dev
# または
docker-compose logs -f app-api

# Worker ログ
docker-compose logs -f worker

# MySQL ログ
docker-compose logs -f mysql

# Redis ログ
docker-compose logs -f redis
```

---

## 🔐 セキュリティ設定

### 本番環境への移行

**.env の本番設定:**

```env
# 本番環境
NODE_ENV=production
PORT=3000

# 強力なシークレット生成
JWT_SECRET=$(openssl rand -base64 32)

# 本番データベース
DATABASE_URL=mysql://prod_user:STRONG_PASSWORD@prod-db-host:3306/diary_prod

# 本番 Redis
REDIS_URL=redis://:REDIS_PASSWORD@prod-redis-host:6379

# 本番 MinIO
MINIO_ENDPOINT=prod-minio-host
MINIO_ACCESS_KEY=PRODUCTION_ACCESS_KEY
MINIO_SECRET_KEY=PRODUCTION_SECRET_KEY
```

### .gitignore 確認

```bash
# 以下のファイルが除外されていることを確認
cat .gitignore | grep -E "\.env|\.backup|\.tmp"
```

---

## 📚 次のステップ

1. **API ドキュメント**: [README.md](../README.md) の API セクション
2. **テストガイド**: [TESTING_GUIDE.md](TESTING_GUIDE.md)
3. **フェーズドキュメント**: [docs/](.)

---

## 🆘 ヘルプ

問題が解決しない場合:

1. **GitHub Issues**: https://github.com/pushnanashi2/diary-mvp/issues
2. **ログ確認**: `docker-compose logs -f`
3. **コンテナステータス**: `docker ps -a`
4. **ディスク容量**: `df -h`
5. **Docker リソース**: Docker Desktop → Settings → Resources

---

**最終更新**: 2026-01-07  
**バージョン**: 2.0.0
