# 🧪 テストガイド - Notion仕様準拠版

## 🎯 テスト方針

### 仕様駆動テスト（Specification-Driven Testing）

全てのテストは**Notion詳細設計**を基準として作成されています：

- **参照ドキュメント**
  - [06. API仕様一覧](https://www.notion.so/06-API-2e0c742b052381578cd9f027ee91f469) - 全エンドポイントの入出力仕様
  - [03. データベース設計](https://www.notion.so/03-2e0c742b052381db9bb8ec4bcf9110d7) - DBスキーマと制約
  - [05. 処理フロー詳細](https://www.notion.so/05-2e0c742b05238145bf30d3db33d65571) - ビジネスロジック

### テストの3原則

1. **入力検証** - 全必須フィールド、バリデーションルールをテスト
2. **出力フォーマット** - JSON構造、型、値の正確性を検証
3. **エラーコード** - 全エラーケースで正しいコードを返却

---

## 📚 テスト構造

```
tests/
├── api/
│   ├── auth.test.js              # 認証 (Notion 06-1)
│   ├── integration/
│   │   ├── entries.test.js       # エントリ (Notion 06-3)
│   │   ├── summaries.test.js     # 期間要約 (Notion 06-5)
│   │   ├── user.test.js          # ユーザー (Notion 06-2)
│   │   └── audio.test.js         # 音声 (Notion 06-4)
│   └── unit/
│       ├── edgeCases.test.js     # エッジケース
│       └── performance.test.js   # パフォーマンス
└── fixtures/
    └── test-audio.wav            # テスト用音声

worker/tests/
├── conftest.py                   # pytest設定 (Notion DBスキーマ)
├── test_action_extractor.py      # アクション抽出
├── test_emotion_analyzer.py      # 感情分析
├── test_keyword_extractor.py     # キーワード抽出
└── test_speech_processor.py      # 音声処理
```

---

## 🛠️ テスト実行

### APIテスト（Node.js + Jest）

```bash
# 全テスト実行
npm test

# 特定のテストファイル
npm test tests/api/auth.test.js

# カバレッジ付き
npm test -- --coverage

# Watchモード
npm test -- --watch

# 特定のテストケース
npm test -- -t "ユーザー登録"
```

### Workerテスト（Python + pytest）

```bash
# 全テスト実行
cd worker
pytest

# カバレッジ付き
pytest --cov=app --cov-report=html

# 詳細出力
pytest -v

# 特定のテストファイル
pytest tests/test_action_extractor.py

# 特定のテスト関数
pytest tests/test_action_extractor.py::test_extract_actions_success
```

---

## 📝 テスト作成ガイド

### ステップ1: Notion仕様を確認

```javascript
/**
 * エントリ作成APIテスト（Notion仕様準拠）
 * 
 * 参照: Notion「06-3. エントリ（Entries）」
 * https://www.notion.so/06-API-2e0c742b052381578cd9f027ee91f469
 * 
 * エンドポイント: POST /entries
 * 
 * リクエスト:
 * {
 *   "content": "テキストまたはaudioファイル",
 *   "mood": "happy" | "sad" | "neutral"
 * }
 * 
 * レスポンス (201):
 * {
 *   "id": 123,
 *   "title": "YYYY-MM-DD-HH-MM-#N",
 *   "content": "...",
 *   "transcript": null,  // workerで後から生成
 *   "summary": null,
 *   "audio_url": "...",
 *   "created_at": "ISO8601"
 * }
 */
```

### ステップ2: 入力検証テスト

```javascript
describe('POST /entries - 入力検証', () => {
  it('必須フィールドが欠けている場合400エラー', async () => {
    const requiredFields = ['content', 'mood'];
    
    for (const field of requiredFields) {
      const input = {
        content: 'テスト',
        mood: 'happy'
      };
      delete input[field];

      const res = await request(app)
        .post('/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send(input);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    }
  });

  it('無効なmood値で400エラー', async () => {
    const res = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'テスト',
        mood: 'invalid_mood'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
```

### ステップ3: 出力検証テスト

```javascript
describe('POST /entries - 出力検証', () => {
  it('Notion仕様通りのレスポンス構造', async () => {
    const res = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'テストエントリ',
        mood: 'happy'
      });

    // ステータス検証
    expect(res.status).toBe(201);

    // 構造検証
    expect(res.body).toHaveProperty('id');
    expect(typeof res.body.id).toBe('number');
    
    expect(res.body).toHaveProperty('title');
    expect(res.body.title).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-#\d+$/);
    
    expect(res.body).toHaveProperty('content');
    expect(res.body.content).toBe('テストエントリ');
    
    expect(res.body).toHaveProperty('mood');
    expect(res.body.mood).toBe('happy');
    
    // worker非同期処理
    expect(res.body.transcript).toBeNull();
    expect(res.body.summary).toBeNull();
    
    // タイムスタンプ
    expect(res.body).toHaveProperty('created_at');
    expect(new Date(res.body.created_at)).toBeInstanceOf(Date);
  });
});
```

### ステップ4: エラーコード検証

```javascript
describe('POST /entries - エラーハンドリング', () => {
  it('認証なしで401エラー (UNAUTHORIZED)', async () => {
    const res = await request(app)
      .post('/entries')
      .send({
        content: 'テスト',
        mood: 'happy'
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBeDefined();
  });

  it('他人のエントリにアクセスで403エラー (FORBIDDEN)', async () => {
    // 別ユーザーのエントリ
    const otherEntryId = 999;

    const res = await request(app)
      .get(`/entries/${otherEntryId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('存在しないIDで404エラー (NOT_FOUND)', async () => {
    const res = await request(app)
      .get('/entries/99999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
```

### ステップ5: DB整合性検証

```javascript
describe('POST /entries - DB整合性', () => {
  it('エントリがDBに正しく保存されること', async () => {
    const res = await request(app)
      .post('/entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'DBテスト',
        mood: 'happy'
      });

    const entryId = res.body.id;

    // DB直接確認
    const dbResult = await db.query(
      'SELECT * FROM entries WHERE id = $1',
      [entryId]
    );

    expect(dbResult.rows.length).toBe(1);
    expect(dbResult.rows[0].content).toBe('DBテスト');
    expect(dbResult.rows[0].mood).toBe('happy');
    expect(dbResult.rows[0].user_id).toBe(userId);
  });
});
```

---

## 🔍 Contract Testing

### API契約テスト

```javascript
// エンドポイントの入出力契約を定義
const API_CONTRACT = {
  'POST /entries': {
    input: {
      required: ['content', 'mood'],
      optional: ['audio'],
      types: {
        content: 'string',
        mood: ['happy', 'sad', 'neutral']
      }
    },
    output: {
      201: {
        schema: {
          id: 'number',
          title: 'string',
          content: 'string',
          transcript: 'null',
          summary: 'null',
          mood: 'string',
          audio_url: 'string|null',
          created_at: 'ISO8601'
        }
      },
      400: { error: { code: 'BAD_REQUEST', message: 'string' } },
      401: { error: { code: 'UNAUTHORIZED', message: 'string' } }
    }
  }
};

// 契約テストの実行
function validateContract(endpoint, response) {
  const contract = API_CONTRACT[endpoint];
  const statusContract = contract.output[response.status];
  
  // スキーマ検証
  for (const [key, type] of Object.entries(statusContract.schema)) {
    expect(response.body).toHaveProperty(key);
    if (type !== 'null') {
      expect(typeof response.body[key]).toBe(type.split('|')[0]);
    }
  }
}
```

---

## 📦 テストデータ管理

### Fixtures

```javascript
// tests/fixtures/users.js
export const testUsers = {
  valid: {
    email: 'test@example.com',
    password: 'TestPass123!',
    name: 'Test User'
  },
  invalid: {
    email: 'invalid-email',
    password: '123',  // 短すぎる
    name: ''          // 空
  }
};

// tests/fixtures/entries.js
export const testEntries = {
  text: {
    content: '今日は良い日でした。',
    mood: 'happy'
  },
  withActions: {
    content: '明日までにレポートを提出する必要がある。',
    mood: 'neutral'
  }
};
```

---

## 📊 カバレッジ目標

| 層 | 目標 | 現状 | ステータス |
|------|------|------|----------|
| **API層** | 95% | 93.2% | 🟡 進行中 |
| **Worker層** | 95% | 92.2% | 🟡 進行中 |
| **Utils** | 95% | 92.7% | 🟡 進行中 |
| **総合** | **95%** | **92.7%** | 🟡 **進行中** |

---

## 🔧 CI/CD統合

### GitHub Actions

```yaml
# .github/workflows/test.yml
jobs:
  api-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
      redis:
        image: redis:7-alpine
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run migrate:test
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3

  worker-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
      - run: pip install -r worker/requirements.txt
      - run: pytest --cov=app --cov-report=xml
      - uses: codecov/codecov-action@v3
```

---

## 🐛 トラブルシューティング

### テストが失敗する場合

1. **Notion仕様を確認**
   - 最新の仕様書を参照
   - 入出力フォーマットの変更を確認

2. **エラーメッセージを読む**
   ```bash
   npm test -- --verbose
   ```

3. **DB状態を確認**
   ```bash
   npm run db:reset
   npm run migrate:test
   ```

4. **キャッシュをクリア**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

---

## 📚 参考資料

- [Jest公式ドキュメント](https://jestjs.io/)
- [pytest公式ドキュメント](https://docs.pytest.org/)
- [Supertest GitHub](https://github.com/visionmedia/supertest)
- [Notion API仕様書](https://www.notion.so/06-API-2e0c742b052381578cd9f027ee91f469)
