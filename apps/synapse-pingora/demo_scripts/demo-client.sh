#!/bin/bash
PROXY="https://localhost:6190"

echo "============================================"
echo "  Synapse-Pingora Demo Client"
echo "============================================"
echo "Proxy URL: $PROXY"
echo ""

# Function to run a curl command and print it
run_test() {
    desc="$1"
    cmd="$2"
    echo -e "\033[1;34m[TEST] $desc\033[0m"
    echo -e "\033[0;90m$ $cmd\033[0m"
    eval "$cmd"
    echo ""
    echo "--------------------------------------------"
    echo ""
}

# 1. Clean Request
run_test "Clean Request (Should Pass)" \
    "curl --tlsv1.2 -k -v '$PROXY/api/v1/auth/status'"

# 2. SQL Injection
run_test "SQL Injection (Should Block)" \
    "curl -k -v '$PROXY/api/v1/users?id=1%27+OR+%271%27=%271'"

# 3. XSS
run_test "XSS Attack (Should Block)" \
    "curl -k -v '$PROXY/search?q=%3Cscript%3Ealert(1)%3C/script%3E'"

# 4. Path Traversal
run_test "Path Traversal (Should Block)" \
    "curl -k -v '$PROXY/files?path=../../etc/passwd'"

