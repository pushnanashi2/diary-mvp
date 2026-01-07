# トラブルシューティングガイド

## テスト実行時の問題

### 1. データベース接続エラー

**エラー**:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解決策**:
```bash
# PostgreSQLが起動しているか確認
psql -U postgres -l

# Dockerで起動する場合
docker-compose up -d postgres

# テスト用データベース作成
psql -U postgres -c "CREATE DATABASE diary_test_db;"

# マイグレーション実行
NODE_ENV=test npm run migrate:test
```

### 2. Redis接続エラー

**エラー**:
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**解決策**:
```bash
# Redisが起動しているか確認
redis-cli ping

# Dockerで起動する場合
docker-compose up -d redis

# ローカルで起動する場合
redis-server
```

### 3. 環境変数が読み込まれない

**エラー**:
```
Error: JWT_SECRET is not defined
```

**解決策**:
```bash
# .env.testファイルを作成
cp .env.example .env.test

# 必要な環境変数を設定
echo "JWT_SECRET=test_jwt_secret_key" >> .env.test
echo "OPENAI_API_KEY=sk-test-mock-key" >> .env.test

# 環境変数を明示的に指定してテスト実行
NODE_ENV=test JWT_SECRET=test_jwt_secret npm test
```

### 4. モジュールが見つからない

**エラー**:
```
Cannot find module '../api/server'
```

**解決策**:
```bash
# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install

# Workerの場合
cd worker
rm -rf venv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 5. OpenAI APIキーエラー

**エラー**:
```
OpenAI API error: Invalid API key
```

**解決策**:
```bash
# テストではOpenAI APIをモックする
# tests/setup.jsで自動的にモックされるはず

# モックが機能しない場合、環境変数を設定
export OPENAI_API_KEY=sk-test-mock-key

# または実際APIキーを使用（非推奨）
export OPENAI_API_KEY=sk-your-real-api-key
```

### 6. タイムアウトエラー

**エラー**:
```
Timeout - Async callback was not invoked within the 5000 ms timeout
```

**解決策**:
```javascript
// 個別のテストでタイムアウトを延長
it('テスト名', async () => {
  // テスト内容
}, 30000); // 30秒

// またはjest.setTimeoutを使用
jest.setTimeout(30000);
```

### 7. ポートが既に使用されている

**エラー**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解決策**:
```bash
# プロセスを特定して終了
lsof -i :3000
kill -9 <PID>

# または別のポートを使用
PORT=3001 npm test
```

### 8. Workerテストエラー

**エラー**:
```
ModuleNotFoundError: No module named 'app'
```

**解決策**:
```bash
cd worker

# Pythonパスを設定
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# またはpytestをworkerディレクトリから実行
pytest tests/
```

## テスト実行手順

### 準備

```bash
# 1. データベースを起動
docker-compose up -d postgres redis

# 2. テスト用DB作成
psql -U postgres -c "DROP DATABASE IF EXISTS diary_test_db;"
psql -U postgres -c "CREATE DATABASE diary_test_db;"

# 3. マイグレーション実行
NODE_ENV=test npm run migrate:test

# 4. 依存関係インストール
npm install
cd worker && pip install -r requirements.txt && cd ..
```

### APIテスト実行

```bash
# 全テスト
npm test

# 特定のテストファイル
npm test -- tests/api/integration/entries.test.js

# カバレッジ付き
npm run test:coverage

# ウォッチモード
npm run test:watch
```

### Workerテスト実行

```bash
cd worker

# 全テスト
pytest

# 特定のテストファイル
pytest tests/test_emotion_analyzer.py -v

# カバレッジ付き
pytest --cov=app --cov-report=html
```

## よくある問題と解決策

### 問題1: テストがランダムに失敗する

**原因**: テスト間のデータ競合、非同期処理

**解決策**:
- 各テストでユニークなデータを使用
- `beforeEach`/`afterEach`でクリーンアップ
- `await`を忘れずに

### 問題2: メモリリーク

**原因**: DB/Redis接続が閉じられていない

**解決策**:
```javascript
afterAll(async () => {
  await db.end();
  await redis.quit();
});
```

### 問題3: テストが遅い

**解決策**:
```bash
# 並列実行
npm test -- --maxWorkers=4
pytest -n 4

# 特定のテストのみ実行
npm test -- --testPathPattern=entries
```

## 問い合わせ

問題が解決しない場合:
1. GitHub Issuesで報告
2. エラーログを添付
3. 環境情報（OS, Nodeバージョン等）を記載
