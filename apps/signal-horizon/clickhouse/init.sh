#!/bin/bash
# ClickHouse initialization script for Signal Horizon Hub
# Runs automatically when container starts via /docker-entrypoint-initdb.d/

set -e

echo "Initializing Signal Horizon ClickHouse schema..."

# Wait for ClickHouse to be ready
until clickhouse-client --query "SELECT 1" > /dev/null 2>&1; do
    echo "Waiting for ClickHouse to be ready..."
    sleep 1
done

# Apply schema
clickhouse-client --database "${CLICKHOUSE_DB:-signal_horizon}" --queries-file /docker-entrypoint-initdb.d/schema.sql

echo "Signal Horizon ClickHouse schema initialized successfully"
