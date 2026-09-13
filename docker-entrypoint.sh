#!/bin/sh
set -e

PORT="${PORT:-4173}"
PERSIST_DIR="${PERSIST_DIR:-/data}"

mkdir -p "$PERSIST_DIR"

echo "=== Mesh Serverless Whiteboard ==="
echo "Port:        $PORT"
echo "Storage:     $PERSIST_DIR"
echo "URL:         http://0.0.0.0:$PORT"
echo "=================================="

exec node ./node_modules/wrangler/bin/wrangler.js dev .svelte-kit/cloudflare/_worker.js \
  --ip 0.0.0.0 \
  --port "$PORT" \
  --persist-to "$PERSIST_DIR" \
  --show-interactive-dev-session false
