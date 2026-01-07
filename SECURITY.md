# 🔒 セキュリティポリシー

## サポートされるバージョン

| バージョン | サポート状況 |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## 脆弱性の報告

セキュリティ上の問題を発見した場合は、**公開 Issue を作成しないでください**。

### 報告方法

1. **GitHub Security Advisory** (推奨)
   - https://github.com/pushnanashi2/diary-mvp/security/advisories/new

2. **Email**
   - security@diary-mvp.com
   - 件名: [SECURITY] 脆弱性報告

### 報告に含めるべき情報

- 脆弱性の種類
- 再現手順
- 影響範囲
- 推奨される修正方法（あれば）

### 報告後の流れ

1. **24時間以内**: 受領確認
2. **7日以内**: 初期分析結果
3. **30日以内**: 修正パッチリリース
4. **修正後**: CVE 発行（必要な場合）

## セキュリティ対策

### 実装済み

- ✅ JWT Bearer Token 認証
- ✅ bcrypt パスワードハッシュ (salt rounds: 10)
- ✅ 2要素認証 (TOTP)
- ✅ レート制限 (Express Rate Limit)
- ✅ CORS 設定
- ✅ Helmet.js セキュリティヘッダー
- ✅ SQL インジェクション対策 (パラメータ化クエリ)
- ✅ XSS 対策 (入力サニタイゼーション)
- ✅ ULID ベース公開 ID (推測不可)
- ✅ 監査ログ
- ✅ 環境変数分離 (.env)

### 今後の実装予定

- ⬜ E2E 暗号化
- ⬜ OAuth2 対応
- ⬜ CSRF トークン
- ⬜ セキュリティスキャン (Snyk)
- ⬜ 定期的な依存関係更新

## 既知の制限事項

### API キーの管理

- **重要**: OpenAI API キーは `.env` ファイルで管理
- **本番環境**: AWS Secrets Manager / HashiCorp Vault を推奨

### データベース

- **暗号化**: TLS 接続を推奨
- **バックアップ**: 定期的なバックアップを実施

### セッション管理

- **JWT 有効期限**: デフォルト 24時間
- **Refresh Token**: 未実装 (計画中)

## セキュリティベストプラクティス

### 開発者向け

1. **環境変数**
   ```bash
   # .env ファイルは絶対に Git に commit しない
   # .gitignore に .env* が含まれていることを確認
   ```

2. **依存関係**
   ```bash
   # 定期的に脆弱性チェック
   npm audit
   npm audit fix
   ```

3. **JWT Secret**
   ```bash
   # 強力なランダム文字列を生成
   openssl rand -base64 32
   ```

### 運用者向け

1. **ファイアウォール**
   - 必要なポートのみ公開 (3000, 3306, 6379)

2. **SSL/TLS**
   - 本番環境では必ず HTTPS を使用

3. **バックアップ**
   - 毎日自動バックアップ
   - 暗号化保存

4. **ログ監視**
   - 異常なアクセスパターンを監視
   - 失敗したログイン試行を記録

## 連絡先

- **セキュリティチーム**: security@diary-mvp.com
- **GitHub Security**: https://github.com/pushnanashi2/diary-mvp/security

---

**最終更新**: 2026-01-07  
**次回レビュー**: 2026-02-07
