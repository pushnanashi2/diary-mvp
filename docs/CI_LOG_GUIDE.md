# CI失敗ログの確認方法

## 自動保存されるログ

CI（GitHub Actions）が失敗した場合、以下の2つの方法で自動的に情報が保存されます：

### 1. ログファイルの自動コミット

**場所**: `ci-logs/failure-YYYY-MM-DDTHH-MM-SS.md`

失敗したワークフローのログが自動的にリポジトリにコミットされます。

**確認方法**:
```bash
# 最新のログを確認
ls -lt ci-logs/
cat ci-logs/failure-*.md | head -100
```

**内容**:
- ワークフローRun ID
- コミットSHA
- ブランチ名
- 失敗したジョブ名
- 失敗したステップ
- 完全なログ出力

### 2. GitHub Issue自動作成

**場所**: [Issues](https://github.com/pushnanashi2/diary-mvp/issues?q=is%3Aissue+label%3Aci-failure)

CI失敗時に自動的にIssueが作成されます。

**ラベル**: `ci-failure`, `bug`

**内容**:
- 失敗したジョブのサマリー
- 失敗したステップ一覧
- ワークフローへの直接リンク

## 使い方

### 出先でエラーを確認したい場合

1. **GitHubモバイルアプリ**または**ブラウザ**でリポジトリを開く
2. **Issuesタブ**を確認 → 自動作成されたCI失敗Issueを見る
3. または**ci-logs/**ディレクトリ → 最新のログファイルを見る

### AIに修正を依頼する場合

**方法1: ログファイルのURLを共有**
```
https://github.com/pushnanashi2/diary-mvp/blob/main/ci-logs/failure-2026-01-07T10-30-00.md
```

**方法2: Issueの内容をコピー**
```
このIssueの内容を見て修正して:
https://github.com/pushnanashi2/diary-mvp/issues/123
```

**方法3: ログの一部を貼り付け**
```
このエラーを修正して:

```
Error: Cannot find module 'express'
```
```

## 仕組み

### Workflow 1: `save-logs.yml`
- **トリガー**: `Test Suite`ワークフローが失敗したとき
- **動作**: 
  1. GitHub APIでワークフローログを取得
  2. `ci-logs/`ディレクトリに保存
  3. 自動コミット＆プッシュ

### Workflow 2: `notify-failure.yml`
- **トリガー**: `Test Suite`ワークフローが失敗したとき
- **動作**:
  1. 失敗情報を収集
  2. GitHub Issueを自動作成
  3. ラベル付け

## 注意事項

- ログは`[skip ci]`付きでコミットされるため、再度CIはトリガーされません
- 同じRun IDのIssueは重複作成されません
- ログファイルは手動で削除可能（定期的なクリーンアップ推奨）

## トラブルシューティング

### ログが保存されない場合

**確認事項**:
1. GitHub Actionsの権限設定
   - Settings → Actions → General → Workflow permissions
   - "Read and write permissions"が有効か確認

2. ワークフローの実行履歴
   - Actions タブで`Save CI Logs on Failure`が実行されているか確認

### Issueが作成されない場合

**確認事項**:
1. 同じRun IDのIssueが既に存在しないか確認
2. リポジトリのIssue機能が有効か確認

---

**これで出先でもスマホからエラーログを確認して、AIに修正を依頼できます！** 📱✨
