#!/usr/bin/env bash
set -euo pipefail
source .secrets/test_user.env

post_to_file () {
  local url="$1"
  local body="$2"
  local out="$3"

  # 本文は$outに保存、HTTPコードだけstdoutへ
  curl -sS --max-time 8 -X POST \
    -H "content-type: application/json" \
    -d "$body" \
    -o "$out" \
    -w "%{http_code}" \
    "$url"
}

extract_token_from_file () {
  local file="$1"
  python3 - "$file" <<'PY'
import json,sys
path=sys.argv[1]
try:
  data=json.load(open(path,"r",encoding="utf-8"))
  print(data.get("access_token",""))
except Exception:
  print("")
PY
}

redact_body () {
  local file="$1"
  python3 - "$file" <<'PY'
import json,sys
path=sys.argv[1]
try:
  data=json.load(open(path,"r",encoding="utf-8"))
  if "access_token" in data:
    data["access_token"]="***REDACTED***"
  print(json.dumps(data, ensure_ascii=False))
except Exception:
  raw=open(path,"rb").read().decode("utf-8","replace")
  print(raw[:500])
PY
}

tmp="$(mktemp)"
cleanup(){ rm -f "$tmp"; }
trap cleanup EXIT

login_body='{"email":"'"${TEST_EMAIL}"'","password":"'"${TEST_PASSWORD}"'"}'

code="$(post_to_file "${API_BASE}/auth/login" "$login_body" "$tmp")"
token="$(extract_token_from_file "$tmp")"

if [ -z "$token" ]; then
  # 未登録の可能性があるので register -> login
  reg_body='{"email":"'"${TEST_EMAIL}"'","password":"'"${TEST_PASSWORD}"'"}'
  _reg_code="$(post_to_file "${API_BASE}/auth/register" "$reg_body" "$tmp" || true)"

  code="$(post_to_file "${API_BASE}/auth/login" "$login_body" "$tmp")"
  token="$(extract_token_from_file "$tmp")"
fi

if [ -z "$token" ]; then
  echo "Failed to get token." >&2
  echo "API_BASE=${API_BASE}" >&2
  echo "login_http_code=${code}" >&2
  echo -n "login_body=" >&2
  redact_body "$tmp" >&2
  echo >&2
  exit 1
fi

cat > .secrets/token.env <<ENV
TOKEN=$token
ENV
chmod 600 .secrets/token.env

echo "OK: token saved to .secrets/token.env"
