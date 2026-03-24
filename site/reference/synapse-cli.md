---
title: Synapse CLI Reference
---

# Synapse CLI

The `synapse` CLI (`synapse-client` package) provides command-line management for Synapse instances.

## Installation

```sh
# From the monorepo
pnpm exec nx run synapse-client:build

# Or install globally
npm install -g @atlascrew/synapse-client
```

## Global Options

| Option | Description |
| --- | --- |
| `--url <url>` | Synapse admin API URL (default: `http://localhost:6191`) |
| `--json` | Output as JSON |
| `--debug` | Enable debug logging |
| `--timeout <ms>` | Request timeout in milliseconds (default: 30000) |

## Environment Variables

| Variable | Description |
| --- | --- |
| `SYNAPSE_URL` | Default URL for the Synapse admin API |
| `SYNAPSE_JSON` | Enable JSON output mode |
| `SYNAPSE_DEBUG` | Enable debug logging |
| `SYNAPSE_TIMEOUT` | Default request timeout (ms) |

## Health & Status

### `synapse health`

Check if the Synapse instance is reachable and healthy.

```sh
synapse health --url http://localhost:6191
```

### `synapse status`

Get detailed runtime status.

```sh
synapse status
```

```
Status: healthy
Uptime: 3h 42m
Workers: 4
Rules: 237
Entities: 1,523
Requests: 458,201
```

### `synapse metrics`

Fetch Prometheus metrics.

```sh
synapse metrics --json
```

## Entity Management

### `synapse entities`

List tracked entities with risk scores.

```sh
synapse entities
```

### `synapse blocks`

List currently blocked entities.

```sh
synapse blocks
```

### `synapse release <ip>`

Release a blocked IP or fingerprint.

```sh
synapse release 192.168.1.100
```

### `synapse release-all`

Release all blocked entities.

```sh
synapse release-all
```

::: warning Destructive action
`release-all` removes all blocks immediately. Use with caution in production.
:::

## Configuration

### `synapse config`

Get the current runtime configuration.

```sh
synapse config --json
```

### `synapse config-set <key> <value>`

Update a runtime configuration value.

```sh
synapse config-set detection.action log
synapse config-set rate_limit.rps 5000
```

## WAF Rules

### `synapse rules`

List loaded WAF rules.

```sh
synapse rules
```

### `synapse rule-add`

Add a custom WAF rule.

```sh
synapse rule-add --name "custom-sqli" \
  --pattern "WAITFOR\s+DELAY" \
  --score 80 \
  --category sqli
```

### `synapse rule-remove <id>`

Remove a rule by ID.

```sh
synapse rule-remove 200200
```

### `synapse rules-clear`

Remove all custom rules (built-in rules are not affected).

```sh
synapse rules-clear
```

### `synapse reload`

Trigger a configuration hot-reload.

```sh
synapse reload
```

### `synapse evaluate`

Test a request against the rule engine without sending real traffic.

```sh
synapse evaluate --path "/api/users?id=1' OR '1'='1" --method GET
```

```
Risk Score: 85
Matched Rules: 200200
Action: block
Detection Time: 25 μs
```

## Actor Tracking

### `synapse actors`

List tracked actors.

```sh
synapse actors
```

### `synapse actor-stats`

Actor statistics summary.

```sh
synapse actor-stats
```

### `synapse actor-fingerprint <id>`

Get fingerprint details for a specific actor.

```sh
synapse actor-fingerprint actor-abc123
```

## Usage Patterns

### Monitor mode (log without blocking)

```sh
synapse config-set detection.action log
synapse reload
```

### Emergency block

```sh
synapse release-all    # Clear existing blocks
synapse config-set rate_limit.rps 100  # Aggressive rate limit
synapse reload
```

### Export metrics to a file

```sh
synapse metrics --json > metrics-$(date +%Y%m%d).json
```
