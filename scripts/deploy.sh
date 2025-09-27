#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   DEPLOY_HOST=example.com DEPLOY_USER=me DEPLOY_PATH=/var/www/html \
#     bash scripts/deploy.sh
#
# Optional:
#   DRY_RUN=1   # show what would change without uploading
#
# Notes:
# - No secrets in this script. Use your SSH key or an agent.
# - sync/data.json on the server is protected from deletion/overwrite.

: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
: "${DEPLOY_USER:?Set DEPLOY_USER}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH}"

EXCLUDE_FILE=".deploy-exclude"
if [[ ! -f "$EXCLUDE_FILE" ]]; then
  echo "Missing $EXCLUDE_FILE; aborting" >&2
  exit 1
fi

RSYNC_FLAGS=(-az --delete --delete-delay --force --filter="merge $EXCLUDE_FILE")
[[ "${DRY_RUN:-}" == "1" ]] && RSYNC_FLAGS+=(--dry-run --itemize-changes -v)

SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"/
DEST="${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "Deploying to ${DEST}" >&2

# Ensure remote directory exists
ssh -o BatchMode=yes "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p '${DEPLOY_PATH}' '${DEPLOY_PATH}/sync'" || true

# Upload
rsync "${RSYNC_FLAGS[@]}" "$SRC_DIR" "$DEST"

# Post-deploy: ensure sync is writable (best-effort; adjust as needed)
ssh -o BatchMode=yes "${DEPLOY_USER}@${DEPLOY_HOST}" "\
  chmod 775 '${DEPLOY_PATH}/sync' 2>/dev/null || true; \
  find '${DEPLOY_PATH}/sync' -type f -name '*.php' -exec chmod 664 {} + 2>/dev/null || true" || true

echo "Done."