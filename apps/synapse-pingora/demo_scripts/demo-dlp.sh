#!/bin/bash
# demo-dlp.sh
# Demonstrates DLP scanning on response bodies

PROXY="https://localhost:6190"

echo "============================================"
echo "  DLP Response Scanning Demo"
echo "============================================"

# We need an endpoint that returns a credit card-like pattern
# Since we don't have control over the upstream's exact content easily without modifying it,
# we rely on the upstream 'demo-targets' having some PII or we can simulate it if the upstream allows reflection.

# The demo-targets might have a PII endpoint.
# Let's try to hit an endpoint that we know might return data, or if it reflects input, we send PII.
# If response body scanning is enabled, it should catch it.

echo "Requesting resource with potential PII..."
# Assuming /api/v1/users/1 might return some mock PII or we use a reflection endpoint
curl -k -v "$PROXY/api/v1/users/1"

echo ""
echo "Check the proxy logs for DLP alerts."
