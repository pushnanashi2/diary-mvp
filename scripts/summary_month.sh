#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

YM="${1:-}"
if [ -z "$YM" ]; then
  echo "Usage: $0 YYYY-MM  (ex: 2026-01)" >&2
  exit 1
fi

# UTCで月初00:00:00Z〜翌月初00:00:00Zの手前まで
START="$(python3 - <<PY
from datetime import datetime, timezone
y,m = map(int, "$YM".split("-"))
print(datetime(y,m,1,0,0,0,tzinfo=timezone.utc).isoformat().replace("+00:00","Z"))
PY
)"

END="$(python3 - <<PY
from datetime import datetime, timezone
y,m = map(int, "$YM".split("-"))
if m==12:
    ny,nm = y+1,1
else:
    ny,nm = y,m+1
# 翌月初の1秒前
end = datetime(ny,nm,1,0,0,0,tzinfo=timezone.utc) - __import__("datetime").timedelta(seconds=1)
print(end.isoformat().replace("+00:00","Z"))
PY
)"

exec ./scripts/range_summary.sh "$START" "$END"
