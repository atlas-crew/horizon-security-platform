#!/bin/bash
# ClickHouse initialization script for Signal Horizon Hub
# Runs automatically when container starts via /docker-entrypoint-initdb.d/

set -e

echo "Initializing Signal Horizon ClickHouse schema..."

# NOTE: clickhouse-client will fail if the target DB doesn't exist yet.
# We create it explicitly so this init works on fresh volumes.
DB_NAME="${CLICKHOUSE_DB:-signal_horizon}"
if [[ ! "${DB_NAME}" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Invalid CLICKHOUSE_DB '${DB_NAME}' (expected [A-Za-z0-9_]+)"
  exit 1
fi

# Wait for ClickHouse to be ready
until clickhouse-client --query "SELECT 1" > /dev/null 2>&1; do
    echo "Waiting for ClickHouse to be ready..."
    sleep 1
done

# Ensure database exists
clickhouse-client --query "CREATE DATABASE IF NOT EXISTS ${DB_NAME}"

# Apply schema
clickhouse-client --database "${DB_NAME}" --multiquery --queries-file /docker-entrypoint-initdb.d/schema.sql

echo "Signal Horizon ClickHouse schema initialized successfully"
