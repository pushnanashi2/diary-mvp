#!/bin/bash

##############################################################################
# 秘密情報クイックセットアップスクリプト
# docker-compose.ymlの設定に基づいて.secrets/を自動生成
##############################################################################

set -e

echo "🔐 秘密情報セットアップ開始"
echo "=============================="
echo ""

# diary-mvpディレクトリに移動
cd /home/pc/diary-mvp

# 1. .secrets/ディレクトリ作成
echo "📁 1/5: .secrets/ ディレクトリ作成"
mkdir -p .secrets
echo "✓ 完了"
echo ""

# 2. DB認証情報作成（docker-compose.ymlと完全一致）
echo "🗄️  2/5: DB認証情報作成"
cat > .secrets/db.creds << 'DBEOF'
{
  "host": "mysql",
  "port": 3306,
  "database": "diary",
  "user": "diary",
  "password": "diary_password"
}
DBEOF
echo "✓ .secrets/db.creds 作成完了"
echo ""

# 3. JWT Secret自動生成
echo "🔑 3/5: JWT Secret自動生成"
openssl rand -base64 48 > .secrets/jwt.secret
echo "✓ .secrets/jwt.secret 作成完了"
echo ""

# 4. OpenAI API Key設定
echo "🤖 4/5: OpenAI API Key設定"
read -p "OpenAI API Key を入力してください: " OPENAI_KEY

if [ -z "$OPENAI_KEY" ]; then
  echo "❌ エラー: API Keyが入力されていません"
  exit 1
fi

echo "$OPENAI_KEY" > .secrets/openai.key
echo "✓ .secrets/openai.key 作成完了"
echo ""

# 5. ファイル保護
echo "🔒 5/5: ファイルパーミッション設定"
chmod 600 .secrets/*
echo "✓ 秘密情報ファイルを保護しました (chmod 600)"
echo ""

# 6. 確認
echo "=============================="
echo "✅ セットアップ完了!"
echo "=============================="
echo ""

echo "📋 作成されたファイル:"
echo ""

echo "=== DB Credentials ==="
cat .secrets/db.creds
echo ""

echo "=== JWT Secret ==="
head -c 32 .secrets/jwt.secret && echo "... (先頭32文字のみ表示)"
echo ""

echo "=== OpenAI Key ==="
head -c 20 .secrets/openai.key && echo "... (先頭20文字のみ表示)"
echo ""

echo "=============================="
echo "📝 次のステップ:"
echo "=============================="
echo ""
echo "1. Dockerコンテナをビルド・起動:"
echo "   docker compose down -v"
echo "   docker compose up -d --build"
echo ""
echo "2. ログ確認:"
echo "   docker compose logs -f app-api"
echo ""
echo "3. ヘルスチェック:"
echo "   curl http://localhost:8000/health"
echo ""
echo "🎉 スクリプト終了"
