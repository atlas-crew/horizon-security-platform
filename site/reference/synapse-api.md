---
title: Synapse Admin API Reference
---

# Synapse Admin API

The Synapse admin API runs on port `6191` by default and provides runtime management endpoints.

## Authentication

All admin endpoints require the `X-Admin-Key` header matching the `admin_api_key` in `config.yaml`. If no key is configured, a random key is generated at startup and logged.

```sh
curl http://localhost:6191/status -H "X-Admin-Key: $ADMIN_KEY"
```

## Health & Status

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/status` | Runtime status and health information |
| `GET` | `/metrics` | Prometheus-format metrics |

**`GET /status` response:**

```json
{
  "status": "healthy",
  "uptime_seconds": 3600,
  "workers": 4,
  "rules_loaded": 237,
  "entities_tracked": 1523,
  "requests_processed": 458201
}
```

## Configuration

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/config` | Get current runtime configuration |
| `POST` | `/config` | Update runtime configuration fields |
| `POST` | `/reload` | Hot-reload configuration from file (~240 μs) |

**Hot-reload:**

```sh
curl -X POST http://localhost:6191/reload -H "X-Admin-Key: $ADMIN_KEY"
```

```json
{
  "status": "reloaded",
  "duration_us": 240
}
```

## Entity Management

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/entities` | List tracked entities with risk scores |
| `POST` | `/block` | Block an IP or fingerprint |
| `POST` | `/release` | Release a blocked entity |
| `POST` | `/release-all` | Release all blocked entities |

**Block an IP:**

```sh
curl -X POST http://localhost:6191/block \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.100", "reason": "manual block"}'
```

**List entities:**

```sh
curl http://localhost:6191/entities -H "X-Admin-Key: $ADMIN_KEY"
```

```json
{
  "entities": [
    {
      "ip": "192.168.1.100",
      "risk_score": 85,
      "blocked": true,
      "first_seen": "2026-03-23T10:00:00Z",
      "last_seen": "2026-03-23T14:30:00Z",
      "request_count": 450
    }
  ]
}
```

## WAF Rules

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/rules` | List loaded WAF rules |
| `POST` | `/rules/add` | Add a custom rule |
| `POST` | `/rules/remove` | Remove a rule by ID |
| `POST` | `/rules/clear` | Clear all custom rules |
| `POST` | `/evaluate` | Test a request against the rule engine |

**Evaluate a test request:**

```sh
curl -X POST http://localhost:6191/evaluate \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"path": "/api/users?id=1 OR 1=1", "method": "GET"}'
```

```json
{
  "risk_score": 85,
  "matched_rules": ["200200"],
  "action": "block",
  "detection_time_us": 25
}
```

## Actor Tracking

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/actors` | List tracked actors |
| `GET` | `/actor-stats` | Actor statistics summary |
| `GET` | `/actor-fingerprint` | Get fingerprint details for an actor |

## Prometheus Metrics

`GET /metrics` returns Prometheus-format metrics:

```
# HELP synapse_requests_total Total requests processed
# TYPE synapse_requests_total counter
synapse_requests_total{status="allowed"} 450000
synapse_requests_total{status="blocked"} 1523

# HELP synapse_detection_duration_us Detection latency in microseconds
# TYPE synapse_detection_duration_us histogram
synapse_detection_duration_us_bucket{le="10"} 380000
synapse_detection_duration_us_bucket{le="25"} 440000
synapse_detection_duration_us_bucket{le="100"} 451000

# HELP synapse_entities_tracked Number of tracked entities
# TYPE synapse_entities_tracked gauge
synapse_entities_tracked 1523
```
