#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

source .secrets/test_user.env
source .secrets/token.env

START="${1:-}"
END="${2:-}"

if [ -z "$START" ] || [ -z "$END" ]; then
  echo "Usage: $0 <range_start> <range_end>" >&2
  echo "Example: $0 2026-01-01T00:00:00Z 2026-01-31T23:59:59Z" >&2
  exit 1
fi

echo "[1] POST /summaries"
resp="$(curl -sS --max-time 15 "${API_BASE}/summaries" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"range_start\":\"${START}\",\"range_end\":\"${END}\"}")"

echo "$resp"

id="$(printf '%s' "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')"

if [ -z "$id" ]; then
  echo "Failed to get summary id" >&2
  exit 1
fi

echo "[2] Polling /summaries/$id (max 60s)"
for i in $(seq 1 30); do
  out="$(curl -sS --max-time 10 "${API_BASE}/summaries/${id}" \
    -H "Authorization: Bearer $TOKEN")"

  text="$(printf '%s' "$out" | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d.get("summary_text"); print("" if t is None else t)')"

  if [ -n "$text" ]; then
    echo "[OK] summary ready"
    echo "$out" | python3 -m json.tool
    exit 0
  fi

  echo "  not ready yet... (${i}/30)"
  sleep 2
done

echo "[TIMEOUT] summary not ready. Check worker logs:" >&2
echo "  docker compose logs --tail=200 worker" >&2
exit 1
