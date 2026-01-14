#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$SCRIPT_DIR/../../.."

echo "Starting Upstream (Demo Targets) on port 5000..."
cd "$REPO_ROOT/apps/demo-targets/api-demo"
export PORT=5000
uv run python app.py
