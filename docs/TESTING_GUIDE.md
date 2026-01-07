# テストガイド

## 概要

diary-mvpプロジェクトの完全なテストスイート。ユニットテスト、統合テスト、E2Eテストを含む。

---

## テスト構成

```
api/tests/
├── setup.js                    # テスト環境セットアップ
├── unit/                       # ユニットテスト
│   ├── validators.test.js
│   ├── logger.test.js
│   └── BaseService.test.js
├── integration/                # 統合テスト
│   ├── auth.test.js
│   └── entries.test.js
├── e2e/                        # E2Eテスト
│   └── user-workflow.test.js
└── fixtures/                   # テストデータ
    └── test-audio.m4a
```

---

## テストの実行

### 全テスト実行
```bash
npm test
```

### ユニットテストのみ
```bash
npm run test:unit
```

### 統合テストのみ
```bash
npm run test:integration
```

### E2Eテストのみ
```bash
npm run test:e2e
```

### ウォッチモード
```bash
npm run test:watch
```

---

## テスト環境のセットアップ

### 1. テスト用データベース作成

```sql
CREATE DATABASE diary_test_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 環境変数設定

`.env.test`ファイルを作成:

```bash
NODE_ENV=test

# Test Database
TEST_MYSQL_HOST=localhost
TEST_MYSQL_PORT=3306
TEST_MYSQL_USER=root
TEST_MYSQL_PASSWORD=
TEST_MYSQL_DB=diary_test_db

# Test Redis
TEST_REDIS_URL=redis://localhost:6379/1

# JWT Secret (test)
JWT_SECRET=test-secret-key
```

### 3. テスト用マイグレーション実行

```bash
mysql -u root -p diary_test_db < db/migrations/001_initial_schema.sql
mysql -u root -p diary_test_db < db/migrations/002_add_pii_fields.sql
# ... 全マイグレーションを実行
```

---

## テストカバレッジ

### カバレッジレポート生成

```bash
npm test -- --coverage
```

### カバレッジ閾値

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

---

## テストの種類

### 1. ユニットテスト

**目的**: 個別の関数・クラスの動作を検証

**対象**:
- Validators
- Logger
- BaseService
- Utilities

**例**:
```javascript
test('有効なULIDを受け入れる', () => {
  const validULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  expect(() => validateULID(validULID)).not.toThrow();
});
```

---

### 2. 統合テスト

**目的**: APIエンドポイントの動作を検証

**対象**:
- Auth API
- Entries API
- Summaries API
- その他全エンドポイント

**例**:
```javascript
test('新規ユーザー登録が成功する', async () => {
  const response = await request(app)
    .post('/auth/register')
    .send({ email: 'test@example.com', password: 'password123' });
  
  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty('access_token');
});
```

---

### 3. E2Eテスト

**目的**: ユーザーワークフロー全体を検証

**対象**:
- ユーザー登録 → ログイン → エントリー作成 → 削除
- 複数機能の連携動作

**例**:
```javascript
test('1. ユーザー登録', async () => {
  const response = await request(app)
    .post('/auth/register')
    .send(testUser);
  
  authToken = response.body.access_token;
});

test('2. エントリー作成', async () => {
  const response = await request(app)
    .post('/entries')
    .set('Authorization', `Bearer ${authToken}`)
    .attach('audio', testAudioPath);
  
  expect(response.status).toBe(201);
});
```

---

## モックとスタブ

### Jestモック例

```javascript
// Redisモック
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

// モックの挙動設定
mockRedis.get.mockResolvedValue(JSON.stringify({ id: 1 }));

// アサーション
expect(mockRedis.get).toHaveBeenCalledWith('test-key');
```

---

## CI/CD統合

### GitHub Actions例

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: diary_test_db
        ports:
          - 3306:3306
      
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## トラブルシューティング

### テストが失敗する場合

1. **データベース接続エラー**
   - MySQLが起動しているか確認
   - テストDBが存在するか確認
   - マイグレーションが実行済みか確認

2. **Redis接続エラー**
   - Redisが起動しているか確認
   - テスト用DB(1)が空か確認

3. **ポート競合**
   - 他のプロセスがポートを使用していないか確認

4. **タイムアウト**
   - `jest.setTimeout(10000)` でタイムアウトを延長

---

## ベストプラクティス

### 1. テストの独立性
- 各テストは独立して実行可能
- 他のテストに依存しない

### 2. データのクリーンアップ
- `beforeEach` / `afterEach` でデータをクリア
- テスト用データにユニークなIDを使用

### 3. 明確なアサーション
- 期待値を明確に記述
- エラーメッセージも検証

### 4. テスト名の明確化
- 何をテストしているか明確に
- 日本語で記述OK

---

## 次のステップ

1. **追加テスト作成**
   - Summaries APIテスト
   - Action Items APIテスト
   - Analytics APIテスト

2. **パフォーマンステスト**
   - 負荷テスト (Apache Bench)
   - ストレステスト

3. **セキュリティテスト**
   - SQLインジェクションテスト
   - XSSテスト
   - 認証バイパステスト

---

*最終更新*: 2026-01-07  
*作成者*: AI Assistant
