#!/bin/bash
# demo-tarpit.sh
# Demonstrates Tarpit functionality

PROXY="https://localhost:6190"

echo "============================================"
echo "  Tarpit Demo"
echo "============================================"

echo "Triggering high risk to engage tarpit..."
# Send a clear attack to get high risk score
curl -s -k -o /dev/null "$PROXY/api/users?id=1%27+OR+%271%27=%271"

echo "Sending request (should be slow)..."
start=$(date +%s%N)
curl -k -s "$PROXY/api/test"
end=$(date +%s%N)
dur=$(( (end - start) / 1000000 ))
echo "Request took ${dur}ms"
