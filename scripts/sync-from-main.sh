#!/usr/bin/env bash
# Sync copied files from the main repo and harness into api/.
# Run this whenever the main repo changes and you want this repo up to date.
#
# Usage:
#   ./scripts/sync-from-main.sh
#
# Env vars (defaults assume sibling layout):
#   KNOWLEDGE_REPO_PATH  — path to knowledge-system-hackathon  (default: ../knowledge-system-hackathon)
#   KNOWLEDGE_KIT_PATH   — path to hackathon-knowledge-kit-participant (default: ../hackathon-knowledge-kit-participant)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$REPO_ROOT/api"

MAIN_REPO="${KNOWLEDGE_REPO_PATH:-$REPO_ROOT/../knowledge-system-hackathon}"
KIT_PATH="${KNOWLEDGE_KIT_PATH:-$REPO_ROOT/../hackathon-knowledge-kit-participant}"
HARNESS_DIR="$KIT_PATH/harness"

sync_file() {
  local src="$1" dst="$2"
  if [ ! -f "$src" ]; then
    echo "SKIP  $src (not found)"
    return
  fi
  if [ -f "$dst" ] && diff -q "$src" "$dst" > /dev/null 2>&1; then
    echo "OK    $(basename "$dst") (unchanged)"
  else
    cp "$src" "$dst"
    echo "SYNC  $(basename "$dst")"
  fi
}

echo "Syncing from main repo: $MAIN_REPO"
sync_file "$MAIN_REPO/solution.py"    "$API_DIR/solution.py"
sync_file "$MAIN_REPO/_chunks.py"     "$API_DIR/_chunks.py"
sync_file "$MAIN_REPO/_preprocess.py" "$API_DIR/_preprocess.py"

echo "Syncing from harness: $HARNESS_DIR"
sync_file "$HARNESS_DIR/contract.py" "$API_DIR/contract.py"

echo "Done."
