# 🔐 Secrets Directory

このディレクトリには、アプリケーションの秘密情報を格納します。

## ⚠️ 重要な注意事項

- **このディレクトリの内容は絶対にGitにコミットしないでください**
- `.gitignore`で除外されています
- 本番環境では適切な権限管理を行ってください

## 📁 ファイル構成

### 必須ファイル (本番環境)

```
.secrets/
  ├── openai.key       # OpenAI APIキー
  ├── jwt.secret       # JWT署名用シークレット
  └── db.creds         # データベース認証情報
```

### セットアップ手順

1. サンプルファイルをコピー:
```bash
cp .secrets/openai.key.example .secrets/openai.key
cp .secrets/jwt.secret.example .secrets/jwt.secret
cp .secrets/db.creds.example .secrets/db.creds
```

2. 各ファイルを編集して実際の値を設定

3. ファイルの権限を制限 (推奨):
```bash
chmod 600 .secrets/*
```

## 📝 ファイルフォーマット

### openai.key
```
sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### jwt.secret
```
your-long-random-secret-string-here-min-32-chars
```

### db.creds
```json
{
  "host": "mysql",
  "port": 3306,
  "database": "diary",
  "user": "diary",
  "password": "your-secure-password"
}
```

## 🔒 セキュリティベストプラクティス

- 秘密情報は定期的にローテーション
- 開発環境と本番環境で異なる値を使用
- チーム内で秘密情報を共有する場合は1Password等のツールを使用
- ログに秘密情報が出力されないよう注意
