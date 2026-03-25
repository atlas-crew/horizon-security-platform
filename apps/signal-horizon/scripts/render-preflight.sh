#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"

cd "$ROOT_DIR"

echo "==> Checking render.yaml is readable"
[ -r render.yaml ] && echo "render.yaml: readable" || { echo "render.yaml: not found"; exit 1; }

echo "==> Building Signal Horizon UI"
pnpm --filter @atlascrew/signal-horizon-ui build

echo "==> Building Signal Horizon API"
# The API build script runs prisma generate before bundling.
pnpm --filter @atlascrew/signal-horizon-api build

echo
echo "Render preflight passed."
echo "Next platform steps:"
echo "  1. Create services from render.yaml"
echo "  2. Fill VITE_API_URL and VITE_WS_URL"
echo "  3. WARNING: set CORS_ORIGINS before first browser login"
echo "  4. Decide whether CLICKHOUSE_ENABLED stays false for first deploy"
