#!/usr/bin/env bash
set -euo pipefail

# Update /gitinfo.json with current HEAD commit info
# Usage: scripts/update-gitinfo.sh [repo_root]

ROOT_DIR="${1:-$(git rev-parse --show-toplevel)}"
cd "$ROOT_DIR"

SHA_SHORT=$(git rev-parse --short HEAD)
ISO=$(git show -s --format=%cI HEAD)
# Convert ISO to ms epoch (portable fallback if node/date not present)
# Prefer GNU date; fallback to python; final fallback leaves empty
TS=""
if command -v gdate >/dev/null 2>&1; then
  TS=$(gdate -d "$ISO" +%s) || TS=""
elif command -v date >/dev/null 2>&1; then
  # macOS BSD date supports -j -f
  TS=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "${ISO/:00/+0000}" +%s 2>/dev/null || true)
fi
if [ -z "$TS" ]; then
  if command -v python3 >/dev/null 2>&1; then
    TS=$(python3 - <<PY
import sys,datetime
from datetime import timezone
s="""$ISO"""
try:
  dt = datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
  print(int(dt.timestamp()))
except Exception:
  print(0)
PY
) || TS=0
  else
    TS=0
  fi
fi
# milliseconds
TS_MS=$((TS * 1000))

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > gitinfo.json <<JSON
{
  "commit": {
    "sha": "${SHA_SHORT}",
    "isoDate": "${ISO}",
    "timestamp": ${TS_MS}
  },
  "generatedAt": "${NOW}"
}
JSON

echo "Updated gitinfo.json -> ${SHA_SHORT} ${ISO}"