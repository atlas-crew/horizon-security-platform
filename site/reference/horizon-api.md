---
title: Horizon API Reference
---

# Horizon REST & WebSocket API

## Authentication

All API requests require an API key passed via the `X-API-Key` header (configurable via `API_KEY_HEADER`).

### Scopes

| Scope | Access |
| --- | --- |
| `signal:write` | Submit signals via WebSocket |
| `dashboard:read` | Subscribe to real-time dashboard feeds |
| `fleet:admin` | Full fleet management and cross-tenant intelligence |

## Health Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Basic health check |
| `GET` | `/health/ready` | Readiness probe — verifies database connections |
| `GET` | `/health/live` | Liveness probe |

No authentication required.

## Fleet Management

### Sensors

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/fleet/sensors` | List all sensors |
| `POST` | `/api/v1/fleet/sensors` | Register a new sensor |
| `GET` | `/api/v1/fleet/sensors/:id` | Get sensor details |
| `DELETE` | `/api/v1/fleet/sensors/:id` | Deregister a sensor |
| `GET` | `/api/v1/fleet/metrics` | Fleet-wide metrics |

**Register a sensor:**

```sh
curl -X POST https://horizon.example.com/api/v1/fleet/sensors \
  -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "US East Primary", "region": "us-east-1"}'
```

```json
{
  "id": "sensor-abc123",
  "token": "sensor-token-xyz789",
  "wsEndpoint": "wss://horizon.example.com/ws/sensors"
}
```

### Commands

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/fleet/commands` | Send a command to a sensor |
| `GET` | `/api/v1/fleet/commands` | List pending commands |
| `GET` | `/api/v1/fleet/commands/:id` | Get command status |

Commands are delivered via WebSocket. If the sensor is offline, the command is queued.

### Configuration Templates

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/fleet/config-templates` | List config templates |
| `POST` | `/api/v1/fleet/config-templates` | Create a config template |
| `GET` | `/api/v1/fleet/config-templates/:id` | Get template details |
| `PUT` | `/api/v1/fleet/config-templates/:id` | Update a template |
| `DELETE` | `/api/v1/fleet/config-templates/:id` | Delete a template |

### Rules

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/fleet/rules` | List fleet rules |
| `POST` | `/api/v1/fleet/rules` | Create a rule |
| `PUT` | `/api/v1/fleet/rules/:id` | Update a rule |
| `DELETE` | `/api/v1/fleet/rules/:id` | Delete a rule |

Rules support deployment strategies: `immediate`, `canary`, `scheduled`.

## Hunt API

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/hunt/query` | Execute a hunt query |
| `GET` | `/api/v1/hunt/saved` | List saved queries |
| `POST` | `/api/v1/hunt/saved` | Save a query |

Hunt queries are routed by time range: < 24h → PostgreSQL, > 24h → ClickHouse, mixed → hybrid.

::: info Rate limiting
Hunt endpoints are rate-limited to protect against expensive queries. The default is 10 requests per minute per API key.
:::

## WebSocket Protocols

### Sensor Connection (`/ws/sensors`)

**Authentication:** API key with `signal:write` scope sent in the initial `auth` message.

**Message types (sensor → hub):**

| Type | Description |
| --- | --- |
| `auth` | Authentication with API key and sensor ID |
| `signal` | Single signal submission |
| `signal-batch` | Batch of signals (preferred) |
| `pong` | Heartbeat response |
| `blocklist-sync` | Request blocklist synchronization |
| `command-ack` | Acknowledge a received command |

**Message types (hub → sensor):**

| Type | Description |
| --- | --- |
| `auth-ok` | Authentication succeeded |
| `ping` | Heartbeat request |
| `command` | Command delivery (config update, rule push, etc.) |
| `blocklist-update` | Blocklist changes |

### Dashboard Connection (`/ws/dashboard`)

**Authentication:** API key with `dashboard:read` scope.

**Default subscriptions:** `campaigns`, `threats`, `blocklist`.

**Message types (hub → dashboard):**

| Type | Description |
| --- | --- |
| `campaign` | New or updated campaign alert |
| `threat` | New threat detection |
| `blocklist` | Blocklist entry created or removed |
| `snapshot` | Full state snapshot (on connect or request) |

**Message types (dashboard → hub):**

| Type | Description |
| --- | --- |
| `subscribe` | Subscribe to a topic |
| `unsubscribe` | Unsubscribe from a topic |
| `snapshot-request` | Request a full state snapshot |

## Error Responses

All error responses follow this format:

```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "statusCode": 400
}
```

| Status | Meaning |
| --- | --- |
| `400` | Invalid request body or parameters |
| `401` | Missing or invalid API key |
| `403` | Insufficient scope |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `503` | Service unavailable (e.g., ClickHouse disabled) |
