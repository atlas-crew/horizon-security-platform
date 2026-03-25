#!/bin/bash
set -e
echo "Setting up demo dependencies..."

# Get absolute path to repo root (assuming we are in apps/synapse-pingora/demo_scripts)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$SCRIPT_DIR/../../.."

# Upstream
echo "Installing upstream dependencies..."
cd "$REPO_ROOT/apps/demo-targets/api-demo"
uv sync --extra dev

# Proxy (Already built, but just in case)
echo "Checking proxy binary..."
if [ ! -f "$REPO_ROOT/apps/synapse-pingora/target/release/synapse-waf" ]; then
    echo "Building synapse-pingora..."
    cd "$REPO_ROOT/apps/synapse-pingora"
    cargo build --release
fi

echo "Setup complete!"
