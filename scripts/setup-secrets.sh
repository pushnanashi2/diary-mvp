#!/bin/bash

##############################################################################
# 秘密情報セットアップスクリプト
# docker-compose.ymlの設定と一致する秘密情報ファイルを自動生成します
##############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_DIR="$SCRIPT_DIR/.secrets"

echo "🔐 秘密情報セットアップスクリプト"
echo "=================================="
echo ""

# .secrets/ディレクトリ作成
if [ ! -d "$SECRETS_DIR" ]; then
  echo "📁 .secrets/ ディレクトリを作成..."
  mkdir -p "$SECRETS_DIR"
fi

##############################################################################
# 1. OpenAI API Key
##############################################################################

echo "📝 1/3: OpenAI API Key"
echo "---------------------"

if [ -f "$SECRETS_DIR/openai.key" ]; then
  echo "⚠️  既存の openai.key が見つかりました"
  read -p "上書きしますか? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "✓ openai.key をスキップ"
  else
    read -p "OpenAI API Key を入力してください: " OPENAI_KEY
    echo "$OPENAI_KEY" > "$SECRETS_DIR/openai.key"
    echo "✓ openai.key を作成しました"
  fi
else
  read -p "OpenAI API Key を入力してください (Enter でスキップ): " OPENAI_KEY
  if [ -n "$OPENAI_KEY" ]; then
    echo "$OPENAI_KEY" > "$SECRETS_DIR/openai.key"
    echo "✓ openai.key を作成しました"
  else
    echo "⏭️  スキップ（後で手動設定してください）"
  fi
fi

echo ""

##############################################################################
# 2. JWT Secret
##############################################################################

echo "🔑 2/3: JWT Secret"
echo "------------------"

if [ -f "$SECRETS_DIR/jwt.secret" ]; then
  echo "⚠️  既存の jwt.secret が見つかりました"
  read -p "再生成しますか? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "✓ jwt.secret をスキップ"
  else
    JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
    echo "$JWT_SECRET" > "$SECRETS_DIR/jwt.secret"
    echo "✓ jwt.secret を再生成しました"
  fi
else
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  echo "$JWT_SECRET" > "$SECRETS_DIR/jwt.secret"
  echo "✓ jwt.secret を自動生成しました"
fi

echo ""

##############################################################################
# 3. Database Credentials (docker-compose.ymlから抽出)
##############################################################################

echo "🗄️  3/3: Database Credentials"
echo "-----------------------------"

# docker-compose.ymlから設定を読み取る
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ エラー: docker-compose.yml が見つかりません"
  exit 1
fi

# docker-compose.ymlからMySQL設定を抽出
DB_NAME=$(grep "MYSQL_DATABASE:" "$COMPOSE_FILE" | head -1 | awk '{print $2}')
DB_USER=$(grep "MYSQL_USER:" "$COMPOSE_FILE" | head -1 | awk '{print $2}')
DB_PASSWORD=$(grep "MYSQL_PASSWORD:" "$COMPOSE_FILE" | head -1 | awk '{print $2}')
DB_HOST="mysql"
DB_PORT="3306"

echo "📋 docker-compose.yml から抽出した設定:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Password: $DB_PASSWORD"
echo ""

if [ -f "$SECRETS_DIR/db.creds" ]; then
  echo "⚠️  既存の db.creds が見つかりました"
  read -p "上書きしますか? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "✓ db.creds をスキップ"
  else
    cat > "$SECRETS_DIR/db.creds" << EOF
{
  "host": "$DB_HOST",
  "port": $DB_PORT,
  "database": "$DB_NAME",
  "user": "$DB_USER",
  "password": "$DB_PASSWORD"
}
EOF
    echo "✓ db.creds を作成しました（docker-compose.ymlと一致）"
  fi
else
  cat > "$SECRETS_DIR/db.creds" << EOF
{
  "host": "$DB_HOST",
  "port": $DB_PORT,
  "database": "$DB_NAME",
  "user": "$DB_USER",
  "password": "$DB_PASSWORD"
}
EOF
  echo "✓ db.creds を作成しました（docker-compose.ymlと一致）"
fi

echo ""

##############################################################################
# ファイルパーミッション設定
##############################################################################

echo "🔒 ファイルパーミッション設定"
echo "----------------------------"
chmod 600 "$SECRETS_DIR"/* 2>/dev/null || true
echo "✓ 秘密情報ファイルを保護しました (chmod 600)"
echo ""

##############################################################################
# 確認
##############################################################################

echo "✅ セットアップ完了"
echo "=================="
echo ""
echo "📁 作成されたファイル:"
echo ""

if [ -f "$SECRETS_DIR/openai.key" ]; then
  echo "  ✓ .secrets/openai.key"
  echo "      $(head -c 20 "$SECRETS_DIR/openai.key")... (先頭20文字のみ表示)"
else
  echo "  ⚠️  .secrets/openai.key (未設定)"
fi

if [ -f "$SECRETS_DIR/jwt.secret" ]; then
  echo "  ✓ .secrets/jwt.secret"
  echo "      $(head -c 32 "$SECRETS_DIR/jwt.secret")... (先頭32文字のみ表示)"
else
  echo "  ⚠️  .secrets/jwt.secret (未設定)"
fi

if [ -f "$SECRETS_DIR/db.creds" ]; then
  echo "  ✓ .secrets/db.creds"
  cat "$SECRETS_DIR/db.creds" | sed 's/^/      /'
else
  echo "  ⚠️  .secrets/db.creds (未設定)"
fi

echo ""

##############################################################################
# 次のステップ
##############################################################################

echo "📝 次のステップ:"
echo ""

if [ ! -f "$SECRETS_DIR/openai.key" ] || [ ! -s "$SECRETS_DIR/openai.key" ]; then
  echo "  1. OpenAI API Key を設定してください:"
  echo "     echo 'sk-proj-YOUR_KEY_HERE' > .secrets/openai.key"
  echo ""
fi

echo "  2. Dockerコンテナをビルド・起動:"
echo "     docker compose down -v"
echo "     docker compose up -d --build"
echo ""
echo "  3. ヘルスチェック:"
echo "     curl http://localhost:8000/health"
echo ""

echo "🎉 セットアップスクリプト終了"
