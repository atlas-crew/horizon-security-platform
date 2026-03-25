# Synapse WAF Demo Instructions

This directory contains scripts to demonstrate the Synapse WAF capabilities.

## Prerequisites

1.  **Dependencies**: Ensure `uv` (Python) and `cargo` (Rust) are installed.
2.  **Setup**: Run the setup script to install dependencies and build the binary.
    ```bash
    ./setup.sh
    ```

## Running the Demo

Open three terminal windows.

**Terminal 1: Upstream Application**
This runs the vulnerable Python Flask application on port 5000.
```bash
./run-upstream.sh
```

**Terminal 2: Synapse WAF Proxy**
This runs the Rust-based WAF proxy on port 6190 (HTTPS).
```bash
./run-proxy.sh
```

**Terminal 3: Demo Client**
This runs a series of `curl` commands to demonstrate blocking and allowing traffic.
```bash
./demo-client.sh
```

## What to Observe

1.  **Clean Traffic**: The first request should pass with `HTTP 200`.
2.  **Attacks**: SQLi, XSS, and Path Traversal requests should return `HTTP 403 Forbidden` with a JSON error body.
3.  **Performance**: Observe the `X-Synapse-Detection-Time-Us` header in the response (if visible/verbose) or logs in Terminal 2.
4.  **TLS**: Traffic is served over HTTPS (self-signed cert).

## Configuration

The proxy configuration is located at `../config.yaml`.
