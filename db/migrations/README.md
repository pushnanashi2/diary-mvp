# データベースマイグレーション

## 概要
このディレクトリはデータベーススキーマの変更履歴を管理します。

## ファイル命名規則
```
{番号}_{説明}.sql
```

例:
- `001_create_users.sql`
- `002_create_entries.sql`
- `004_add_public_ids.sql`

## 実行方法

### 手動実行
```bash
docker compose exec mysql mysql -u diary -pdiary_password diary < db/migrations/004_add_public_ids.sql
```

### 一括実行
```bash
for f in db/migrations/*.sql; do
  echo "Executing $f"
  docker compose exec -T mysql mysql -u diary -pdiary_password diary < "$f"
done
```

## 注意事項
- **番号は連番にすること** - 欠番を作らない
- **ロールバックSQLは別ファイル** - `{番号}_{説明}_rollback.sql`
- **本番適用前にバックアップ** - 必須
- **既存データへの影響を確認** - UPDATE文の影響行数など
