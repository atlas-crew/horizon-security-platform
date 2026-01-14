#!/bin/bash
# Full 10-Step Demo Script for Synapse-Pingora
# Usage: ./demo-script.sh

PROXY="https://localhost:6190"
COLOR_RESET="\033[0m"
COLOR_INFO="\033[1;34m"
COLOR_SUCCESS="\033[1;32m"
COLOR_WARN="\033[1;33m"
COLOR_ERROR="\033[1;31m"

print_step() {
    echo -e "\n${COLOR_INFO}=== STEP $1: $2 ===${COLOR_RESET}"
    echo -e "${COLOR_WARN}$3${COLOR_RESET}\n"
    read -p "Press Enter to execute..."
}

check_status() {
    echo -n "Checking Proxy Status... "
    if curl -s -k -o /dev/null "$PROXY/api/health"; then
        echo -e "${COLOR_SUCCESS}OK${COLOR_RESET}"
    else
        echo -e "${COLOR_ERROR}FAILED${COLOR_RESET} - Ensure synapse-pingora is running!"
        exit 1
    fi
}

# --- Demo Start ---

echo -e "${COLOR_INFO}Starting Synapse-Pingora Demo Sequence${COLOR_RESET}"
check_status

# 1. Dashboard Overview (Manual)
print_step 1 "Dashboard Overview" "Open http://localhost:5176 in your browser. Show clean state, real-time metrics."
echo "Action: Manual verification of dashboard."

# 2. API Discovery (Traffic Generation)
print_step 2 "API Discovery" "Generating clean traffic to discover endpoints..."
echo "Sending requests to /api/users, /api/products, /api/auth/login..."
for i in {1..5}; do
    curl -s -k -o /dev/null "$PROXY/api/users"
    curl -s -k -o /dev/null "$PROXY/api/products/123"
    curl -s -k -o /dev/null -X POST -d '{"user":"test"}' "$PROXY/api/auth/login"
    echo -n "."
    sleep 0.2
done
echo -e "\n${COLOR_SUCCESS}Done.${COLOR_RESET} Check 'API Catalog' in Dashboard."

# 3. API Profiling (Manual)
print_step 3 "API Profiling" "Click into an endpoint in the Dashboard (e.g. /api/users). Show learned schema."
echo "Action: Manual verification in Dashboard."

# 4. Single Attack — Blocked
print_step 4 "Single Attack — Blocked" "Sending SQL Injection attack..."
cmd="curl -k -v \"$PROXY/api/users?id=1' OR '1'='1\""
echo "$ $cmd"
eval $cmd
echo -e "\n${COLOR_SUCCESS}Expect HTTP 403 Forbidden.${COLOR_RESET}"

# 5. Schema Violation → Block
print_step 5 "Schema Violation → Block" "Sending malformed request (String where Int expected)..."
# Assuming /api/products/{id} expects integer
cmd="curl -k -v \"$PROXY/api/products/abc-string-id\""
echo "$ $cmd"
eval $cmd
echo -e "\n${COLOR_SUCCESS}Expect HTTP 403 (or block log if strict mode).${COLOR_RESET}"

# 6. Behavioral Blocking (Threshold Crossing)
print_step 6 "Behavioral Blocking" "Sending multiple attacks to cross risk threshold (Accumulation)..."
echo "Sending 5 SQLi attacks..."
for i in {1..5}; do
    curl -s -k -o /dev/null "$PROXY/api/users?id=1' OR '1'='1"
    echo -n "."
    sleep 0.5
done
echo -e "\n${COLOR_SUCCESS}Threshold should be crossed.${COLOR_RESET}"

# 7. Clean Request — Still Blocked
print_step 7 "Clean Request — Still Blocked" "Sending legitimate request from same IP..."
cmd="curl -k -v \"$PROXY/api/users\""
echo "$ $cmd"
eval $cmd
echo -e "\n${COLOR_SUCCESS}Expect HTTP 403 Forbidden (Global Block).${COLOR_RESET}"

# 8. Entity Tracking (Manual)
print_step 8 "Entity Tracking" "Go to 'Security' > 'Entities' in Dashboard. Show risk history and blocking reason."
echo "Action: Manual verification in Dashboard."

# 9. DLP Scanning
print_step 9 "DLP Scanning" "Triggering PII response..."
# We need an endpoint that reflects data or mimics PII. 
# If upstream echo is running, we can send it.
cmd="curl -k -v -X POST -d '{\"cc\":\"4532-0151-1283-0366\"}' \"$PROXY/api/echo\""
echo "$ $cmd"
eval $cmd
echo -e "\n${COLOR_SUCCESS}Check logs/dashboard for DLP Alert.${COLOR_RESET}"

# 10. Signal Horizon Fleet View (Manual)
print_step 10 "Signal Horizon Fleet View" "Open http://localhost:5180 (Signal Horizon). Show multi-sensor view."
echo "Action: Manual verification of Signal Horizon."

echo -e "\n${COLOR_INFO}Demo Complete!${COLOR_RESET}"
