# Tunnel Load Testing

This guide covers the tunnel load test harness in `apps/synapse-pingora/src/bin/tunnel_load_test.rs`.

## Goals

- 50+ concurrent tunnel clients
- Mixed workload logs: 1000 msgs/sec per client
- Mixed workload shell: 100 cmds/sec per client
- Mixed workload diag: 50 reqs/sec per client
- Reconnect stability and heartbeat health

## Run (Mock Signal Horizon)

```bash
cargo run --manifest-path apps/synapse-pingora/Cargo.toml --bin tunnel_load_test -- \
  --clients 50 \
  --duration-secs 60 \
  --logs-per-sec 1000 \
  --shell-per-sec 100 \
  --diag-per-sec 50
```

The binary starts a local mock tunnel server and connects clients to it.

## Run (Real Signal Horizon)

```bash
cargo run --manifest-path apps/synapse-pingora/Cargo.toml --bin tunnel_load_test -- \
  --url ws://localhost:3100/ws/tunnel/sensor \
  --clients 50 \
  --duration-secs 60 \
  --api-key <sensor_api_key>
```

Notes:
- Real environment must accept the provided API key and sensor IDs.
- Expect to provision multiple sensor API keys or relax auth in a test env.

## Output

The harness prints totals and per-second send rates:

```
logs_sent=...
shell_sent=...
diag_sent=...
send_errors=...
```

## Success Criteria Checklist

- Reconnect within 30s of a server restart
- No sustained increase in FD count (see `FD_LIFECYCLE.md`)
- Memory stable (no growth >10MB over 1h)
- CPU <50% on test host
- Zero message loss (no send errors)

## Report Template

```
Date:
Host:
Clients:
Duration:
Logs/sec:
Shell/sec:
Diag/sec:
Send errors:
Reconnect behavior:
FD drift:
Memory delta:
CPU average:
Notes:
```
