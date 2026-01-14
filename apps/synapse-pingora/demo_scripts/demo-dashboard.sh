#!/bin/bash
# demo-dashboard.sh
# Check dashboard/telemetry status

PROXY="https://localhost:6190"
SIGNAL_HORIZON="http://localhost:3000"
RISK_SERVER="http://localhost:4100"

echo "============================================"
echo "  Dashboard Connectivity Check"
echo "============================================"

check_service() {
    name="$1"
    url="$2"
    echo -n "Checking $name ($url)... "
    if curl -s -o /dev/null "$url"; then
        echo "OK"
    else
        echo "FAILED (Make sure service is running)"
    fi
}

check_service "Signal Horizon" "$SIGNAL_HORIZON"
check_service "Risk Server" "$RISK_SERVER/_sensor/status"
check_service "Synapse-Pingora Proxy" "$PROXY/api/test" -k
check_service "Upstream" "http://localhost:5000/healthz"
