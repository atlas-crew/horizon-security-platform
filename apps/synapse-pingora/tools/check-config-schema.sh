#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

tmp_schema="$(mktemp)"
trap 'rm -f "$tmp_schema"' EXIT

cargo run --bin generate-schema > "$tmp_schema"

if ! diff -u config.schema.json "$tmp_schema"; then
  echo "config.schema.json is out of date."
  echo "Run: cargo run --bin generate-schema > config.schema.json"
  exit 1
fi

echo "config.schema.json is up to date."
