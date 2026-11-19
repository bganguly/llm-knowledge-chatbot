#!/usr/bin/env bash
# Deploy the Cloudflare Worker.
#
# Prerequisites:
#   wrangler installed (npm install inside worker/)
#   wrangler authenticated (wrangler login)
#   API_URL secret set: wrangler secret put API_URL  (from worker/ dir)
#
# Usage:
#   ./scripts/deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$SCRIPT_DIR/../worker"

echo "Installing worker dependencies..."
cd "$WORKER_DIR"
npm install

echo "Deploying Cloudflare Worker..."
npx wrangler deploy

echo "Done. Set API_URL secret if not already done:"
echo "  cd $WORKER_DIR && npx wrangler secret put API_URL"
