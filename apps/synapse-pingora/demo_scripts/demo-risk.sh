#!/bin/bash
# demo-risk.sh
# Demonstrates risk accumulation and eventual blocking

PROXY="https://localhost:6190"

echo "============================================"
echo "  Risk Accumulation Demo"
echo "============================================"

# Reset risk for this IP (if we had an admin API, we'd use it here)
# For now, we assume a fresh start or different IP

echo "Sending 10 'suspicious' requests (404s with weird headers)..."

for i in {1..10}; do
  echo -n "."
  # A 404 is often low risk, but let's try to trigger a minor rule
  # Using a header that might be suspicious but not blocking immediately
  curl -s -k -o /dev/null -H "User-Agent: suspicious-bot" "$PROXY/non-existent-$i"
  sleep 0.2
done
echo ""

echo "Checking if we are blocked..."
curl -k -v "$PROXY/api/test"
