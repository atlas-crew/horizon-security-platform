#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$SCRIPT_DIR/../../.."

echo "Starting Synapse-Pingora Proxy on port 6190..."
cd "$REPO_ROOT/apps/synapse-pingora"
./target/release/synapse-pingora
