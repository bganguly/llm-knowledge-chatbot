#!/usr/bin/env bash
# Delete the deployed Cloudflare Worker.
#
# Usage:
#   ./scripts/infra-down.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$SCRIPT_DIR/../worker"

cd "$WORKER_DIR"
echo "Deleting Cloudflare Worker lm-knowledge-chatbot..."
npx wrangler delete --name lm-knowledge-chatbot
echo "Done."
