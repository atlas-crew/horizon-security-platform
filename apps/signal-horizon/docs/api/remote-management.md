# Remote Management API

The Remote Management API provides secure, authenticated access to remote Synapse WAF sensors for monitoring, diagnostics, control operations, and file management. This API enables fleet-wide management capabilities through a unified interface.

## Overview

### Purpose

The Remote Management feature allows Signal Horizon operators to:

- Access remote terminal sessions on sensors (shell)
- Stream real-time logs from sensors
- Collect diagnostic information (health, memory, connections, rules, actors)
- Execute service control commands (reload, restart, shutdown, drain, resume)
- Browse and transfer files securely
- Manage firmware releases and rollouts

### Architecture

Remote management uses a WebSocket tunnel protocol for real-time bidirectional communication. REST endpoints handle session initialization, diagnostic collection, and control operations.

```
Dashboard Client <---> Signal Horizon API <---> WebSocket Tunnel <---> Sensor
                           |
                           +---> REST Endpoints (Diagnostics, Control, Files, Releases)
```

### Base URL

```
https://api.signal-horizon.example.com/api/v1
```

## Authentication

### API Key Authentication

All API endpoints require Bearer token authentication using an API key.

```http
Authorization: Bearer <api-key>
```

API keys are hashed (SHA-256) for secure storage and validated against the `ApiKey` table. Keys must be:
- Not revoked (`isRevoked: false`)
- Not expired (if expiration is set)

### Required Scopes

Each endpoint requires specific scopes. API keys are granted scopes at creation time.

| Feature | Required Scopes |
|---------|----------------|
| Shell Access | `sensor:shell` |
| Log Streaming | `sensor:logs` |
| Diagnostics | `sensor:diag` |
| Service Control (non-destructive) | `sensor:control` |
| Service Control (destructive) | `sensor:admin` |
| File Operations | `sensor:files` |
| Release Management (read) | `releases:read` |
| Release Management (write) | `releases:write` |

### Multi-Tenant Isolation

All requests are scoped to the tenant associated with the API key. Sensors, sessions, and operations are isolated by `tenantId`.

---

## Shell Access (P0)

Remote terminal access with PTY support for direct sensor interaction.

### WebSocket Tunnel Protocol

Connect to the shell channel via WebSocket for interactive terminal sessions.

#### 1. Request Shell Session

```http
POST /api/v1/tunnel/shell/:sensorId
X-Org-Id: <tenant-id>
X-User-Id: <user-id>
```

**Response:**

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sensorId": "sensor-prod-01",
  "type": "shell",
  "wsUrl": "/ws/tunnel/user/550e8400-e29b-41d4-a716-446655440000",
  "expiresIn": 300
}
```

#### 2. Connect WebSocket

```javascript
const ws = new WebSocket('wss://api.signal-horizon.example.com/ws/tunnel/user/<sessionId>');
```

#### 3. Shell Message Protocol

**Start Shell:**

```json
{
  "channel": "shell",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceId": 0,
  "timestamp": 1705420800000,
  "type": "start",
  "cols": 120,
  "rows": 40,
  "shell": "/bin/bash",
  "env": {
    "TERM": "xterm-256color"
  }
}
```

**Shell Data (bidirectional):**

```json
{
  "channel": "shell",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceId": 42,
  "timestamp": 1705420800000,
  "type": "data",
  "data": "bHMgLWxhCg=="
}
```

> Note: `data` is Base64 encoded. Max size: 64KB per message.

**Resize Terminal:**

```json
{
  "channel": "shell",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceId": 43,
  "timestamp": 1705420800000,
  "type": "resize",
  "cols": 150,
  "rows": 50
}
```

**Shell Exit:**

```json
{
  "channel": "shell",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceId": 100,
  "timestamp": 1705420800000,
  "type": "exit",
  "code": 0,
  "signal": null
}
```

### Rate Limits

| Limit | Value |
|-------|-------|
| Messages per second | 100 |
| Bytes per second | 655,360 (10 chunks) |
| Max sessions per sensor | 3 |

### Session Lifecycle

| State | Description |
|-------|-------------|
| `starting` | Session initialization in progress |
| `active` | Session is active and accepting messages |
| `closing` | Graceful shutdown initiated |
| `closed` | Session terminated |
| `error` | Session in error state |

---

## Log Streaming (P0)

Real-time log streaming with filtering and historical backfill.

### WebSocket Subscription Protocol

#### Subscribe to Logs

```json
{
  "channel": "logs",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceId": 0,
  "timestamp": 1705420800000,
  "type": "subscribe",
  "sources": ["access", "error", "security"],
  "filter": {
    "minLevel": "warn",
    "pattern": "SQL",
    "components": ["waf", "proxy"],
    "since": 1705417200000
  },
  "backfill": true,
  "backfillLines": 100
}
```

#### Available Log Sources

| Source | Description |
|--------|-------------|
| `system` | System/OS logs |
| `sensor` | Sensor application logs |
| `access` | HTTP access logs |
| `error` | Error logs |
| `audit` | Audit trail logs |
| `security` | Security event logs |

#### Filter Options

| Field | Type | Description |
|-------|------|-------------|
| `minLevel` | `string` | Minimum log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `pattern` | `string` | Text pattern to match (case-insensitive) |
| `regex` | `string` | Regular expression pattern |
| `components` | `string[]` | Filter by component names |
| `since` | `number` | Start time (Unix timestamp ms) |
| `until` | `number` | End time (Unix timestamp ms) |

#### Log Entry Message

```json
{
  "channel": "logs",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceId": 42,
  "timestamp": 1705420800000,
  "type": "entry",
  "source": "security",
  "level": "warn",
  "message": "SQL injection attempt detected",
  "logTimestamp": 1705420799500,
  "component": "waf",
  "fields": {
    "ruleId": "SQLI-001",
    "clientIp": "203.0.113.50",
    "uri": "/api/users?id=1'OR'1'='1"
  }
}
```

#### Backfill Complete Notification

```json
{
  "channel": "logs",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceId": 100,
  "timestamp": 1705420800000,
  "type": "backfill-complete",
  "count": 100,
  "sources": ["access", "error", "security"]
}
```

### Rate Limits

| Limit | Value |
|-------|-------|
| Messages per second | 500 |
| Bytes per second | 1,048,576 (1 MB) |
| Max sessions per sensor | 5 |
| Max backfill lines | 1000 |

---

## Diagnostics (P1)

Collect diagnostic information from sensors via REST endpoints.

### GET /api/v1/fleet/:sensorId/diagnostics

Collect diagnostics from a sensor.

**Required Scope:** `sensor:diag`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sections` | `string` | `health,memory,connections` | Comma-separated diagnostic sections |
| `timeout` | `number` | `30000` | Request timeout in milliseconds (1000-60000) |

**Available Sections:**

| Section | Description |
|---------|-------------|
| `health` | Overall health status and component states |
| `memory` | Memory usage (heap, RSS, GC stats) |
| `connections` | Active connection information |
| `rules` | Loaded rules and trigger statistics |
| `actors` | Threat actor tracking information |
| `config` | Current configuration (secrets redacted) |
| `metrics` | Performance metrics snapshot |
| `threads` | Thread pool status |
| `cache` | Cache statistics and hit rates |

**Example Request:**

```http
GET /api/v1/fleet/sensor-prod-01/diagnostics?sections=health,memory,metrics&timeout=15000
Authorization: Bearer <api-key>
```

**Example Response:**

```json
{
  "sensorId": "sensor-prod-01",
  "collectedAt": "2026-01-16T12:00:00.000Z",
  "collectionTimeMs": 45,
  "sections": ["health", "memory", "metrics"],
  "data": {
    "health": {
      "diagType": "health",
      "status": "healthy",
      "uptime": 86400,
      "version": "0.1.0",
      "components": [
        { "name": "memory", "status": "healthy", "message": null },
        { "name": "tunnel", "status": "healthy", "message": null },
        { "name": "rules", "status": "healthy", "message": null }
      ]
    },
    "memory": {
      "diagType": "memory",
      "heapUsed": 150000000,
      "heapTotal": 500000000,
      "heapLimit": 1073741824,
      "external": 10000000,
      "rss": 300000000,
      "arrayBuffers": 5000000,
      "gcStats": {
        "collections": 1234,
        "pauseMs": 5.2
      }
    },
    "metrics": {
      "diagType": "metrics",
      "requestsTotal": 1234567,
      "requestsPerSecond": 500,
      "latencyP50": 5.2,
      "latencyP95": 28.5,
      "latencyP99": 95.3,
      "errorsTotal": 1234,
      "errorRate": 0.001,
      "bytesIn": 10000000000,
      "bytesOut": 50000000000
    }
  }
}
```

### GET /api/v1/fleet/:sensorId/diagnostics/live

Server-Sent Events (SSE) endpoint for live diagnostics streaming.

**Required Scope:** `sensor:diag`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sections` | `string` | `health,metrics` | Comma-separated diagnostic sections |
| `interval` | `number` | `1000` | Update interval in milliseconds (500-30000) |

**Example Request:**

```http
GET /api/v1/fleet/sensor-prod-01/diagnostics/live?sections=health,metrics&interval=2000
Authorization: Bearer <api-key>
Accept: text/event-stream
```

**SSE Events:**

```
event: connected
data: {"sensorId":"sensor-prod-01","interval":2000}

event: diagnostics
data: {"sensorId":"sensor-prod-01","collectedAt":"2026-01-16T12:00:00.000Z",...}

event: status
data: {"type":"offline","sensorId":"sensor-prod-01","connectionState":"DISCONNECTED",...}
```

### POST /api/v1/fleet/:sensorId/diagnostics/run

Run a specific diagnostic check with custom parameters.

**Required Scope:** `sensor:diag`

**Request Body:**

```json
{
  "sections": ["health", "memory", "connections"],
  "params": {
    "includeDetails": true
  }
}
```

**Response:** Same as GET `/diagnostics`

### GET /api/v1/fleet/:sensorId/diagnostics/history

Get historical diagnostics data for trend analysis.

**Required Scope:** `sensor:diag`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `section` | `string` | Diagnostic section to retrieve |
| `from` | `string` | Start timestamp (ISO 8601) |
| `to` | `string` | End timestamp (ISO 8601) |
| `limit` | `number` | Maximum entries (default: 100) |

---

## Service Control (P1)

Execute service control operations on sensors.

### POST /api/v1/fleet-control/:sensorId/control/:command

Execute a control command on a sensor.

**Required Scopes:**
- `sensor:control` for: `reload`, `drain`, `resume`
- `sensor:admin` for: `restart`, `shutdown`

**Path Parameters:**

| Parameter | Description |
|-----------|-------------|
| `sensorId` | Target sensor ID |
| `command` | One of: `reload`, `restart`, `shutdown`, `drain`, `resume` |

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |
| `X-Confirm-Token` | For `restart`, `shutdown` | Confirmation token for destructive commands |

**Request Body (optional):**

```json
{
  "reason": "Configuration update deployment",
  "metadata": {
    "deploymentId": "deploy-2026-01-16-001"
  }
}
```

**Commands:**

| Command | Description | Scope Required |
|---------|-------------|----------------|
| `reload` | Hot-reload configuration without restart | `sensor:control` |
| `restart` | Graceful restart (drains connections first) | `sensor:admin` |
| `shutdown` | Graceful shutdown (drains connections first) | `sensor:admin` |
| `drain` | Stop accepting new connections, finish existing | `sensor:control` |
| `resume` | Resume accepting connections after drain | `sensor:control` |

**Example Request (non-destructive):**

```http
POST /api/v1/fleet-control/sensor-prod-01/control/reload
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "reason": "Configuration update"
}
```

**Example Request (destructive):**

```http
POST /api/v1/fleet-control/sensor-prod-01/control/restart
Authorization: Bearer <api-key>
X-Confirm-Token: confirm-restart-2026-01-16
Content-Type: application/json

{
  "reason": "Security patch deployment"
}
```

**Success Response:**

```json
{
  "command": "reload",
  "success": true,
  "message": "Configuration reload initiated",
  "state": "running",
  "sensorId": "sensor-prod-01",
  "sensorName": "Production Sensor 01",
  "auditId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-16T12:00:00.000Z",
  "durationMs": 150
}
```

**Error Response (confirmation required):**

```json
{
  "error": "Confirmation required",
  "message": "Destructive command 'restart' requires X-Confirm-Token header",
  "command": "restart",
  "hint": "Include a unique confirmation token in the X-Confirm-Token header"
}
```

### GET /api/v1/fleet-control/:sensorId/state

Get the current service state for a sensor.

**Required Scope:** `sensor:control`

**Response:**

```json
{
  "sensorId": "sensor-prod-01",
  "sensorName": "Production Sensor 01",
  "state": "running",
  "activeConnections": 450,
  "isAccepting": true,
  "isOnline": true,
  "connectionState": "CONNECTED",
  "uptime": 86400,
  "lastHeartbeat": "2026-01-16T11:59:30.000Z",
  "lastReload": "2026-01-15T08:00:00.000Z",
  "timestamp": "2026-01-16T12:00:00.000Z"
}
```

**Service States:**

| State | Description |
|-------|-------------|
| `running` | Normal operation, accepting connections |
| `draining` | Not accepting new connections, finishing existing |
| `restarting` | Restart in progress |
| `shutting_down` | Shutdown in progress |

### GET /api/v1/fleet-control/:sensorId/audit

Get control command audit log for a sensor.

**Required Scope:** `sensor:admin`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `50` | Max entries (max: 100) |
| `offset` | `number` | `0` | Pagination offset |

**Response:**

```json
{
  "sensorId": "sensor-prod-01",
  "sensorName": "Production Sensor 01",
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2026-01-16T12:00:00.000Z",
      "command": "reload",
      "result": "success",
      "confirmed": false,
      "reason": "Configuration update",
      "durationMs": 150,
      "errorMessage": null,
      "userId": "user-001"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### POST /api/v1/fleet-control/batch/control/:command

Execute a control command on multiple sensors.

**Required Scopes:** Same as individual control endpoint

**Request Body:**

```json
{
  "sensorIds": ["sensor-prod-01", "sensor-prod-02", "sensor-prod-03"],
  "reason": "Fleet-wide configuration update"
}
```

**Response:**

```json
{
  "command": "reload",
  "results": [
    {
      "sensorId": "sensor-prod-01",
      "sensorName": "Production Sensor 01",
      "success": true,
      "message": "Configuration reload initiated",
      "state": "running"
    },
    {
      "sensorId": "sensor-prod-02",
      "sensorName": "Production Sensor 02",
      "success": false,
      "message": "Sensor offline",
      "state": "unknown"
    }
  ],
  "summary": {
    "total": 3,
    "success": 2,
    "failure": 1
  },
  "durationMs": 450,
  "timestamp": "2026-01-16T12:00:00.000Z"
}
```

---

## File Transfer (P2)

Secure file browsing and transfer for sensors.

### GET /api/v1/fleet/:sensorId/files

List files in a directory on the sensor.

**Required Scope:** `sensor:files`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `string` | `/var/log/synapse` | Directory path to list |
| `timeout` | `number` | `30000` | Request timeout (1000-60000 ms) |

**Example Request:**

```http
GET /api/v1/fleet/sensor-prod-01/files?path=/var/log/synapse
Authorization: Bearer <api-key>
```

**Response:**

```json
{
  "sensorId": "sensor-prod-01",
  "sensorName": "Production Sensor 01",
  "path": "/var/log/synapse",
  "entries": [
    {
      "path": "/var/log/synapse/access.log",
      "name": "access.log",
      "size": 10485760,
      "modified": "2026-01-16T11:55:00.000Z",
      "isDir": false
    },
    {
      "path": "/var/log/synapse/error.log",
      "name": "error.log",
      "size": 1048576,
      "modified": "2026-01-16T11:50:00.000Z",
      "isDir": false
    },
    {
      "path": "/var/log/synapse/archive",
      "name": "archive",
      "size": 0,
      "modified": "2026-01-15T00:00:00.000Z",
      "isDir": true
    }
  ],
  "total": 3,
  "truncated": false
}
```

### GET /api/v1/fleet/:sensorId/files/stat

Get information about a specific file.

**Required Scope:** `sensor:files`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `string` | Required | File path to stat |
| `includeChecksum` | `boolean` | `false` | Include SHA-256 checksum |
| `timeout` | `number` | `30000` | Request timeout |

**Response:**

```json
{
  "sensorId": "sensor-prod-01",
  "sensorName": "Production Sensor 01",
  "file": {
    "path": "/var/log/synapse/access.log",
    "name": "access.log",
    "size": 10485760,
    "modified": "2026-01-16T11:55:00.000Z",
    "isDir": false,
    "checksum": "a1b2c3d4e5f6..."
  }
}
```

### GET /api/v1/fleet/:sensorId/files/download

Download a file from the sensor.

**Required Scope:** `sensor:files`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `string` | Required | File path to download |
| `timeout` | `number` | `30000` | Request timeout |

**Response Headers:**

| Header | Description |
|--------|-------------|
| `Content-Disposition` | `attachment; filename="<filename>"` |
| `Content-Type` | `application/octet-stream` |
| `X-File-Size` | Original file size in bytes |
| `X-Checksum` | SHA-256 checksum (if available) |

> Note: Files larger than 10 MB are streamed in chunks.

### GET /api/v1/fleet/:sensorId/files/download-chunk

Download a single chunk of a file (for resumable downloads).

**Required Scope:** `sensor:files`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `string` | Required | File path |
| `offset` | `number` | `0` | Byte offset to start reading |
| `timeout` | `number` | `30000` | Request timeout |

**Response:**

```json
{
  "sensorId": "sensor-prod-01",
  "sensorName": "Production Sensor 01",
  "chunk": {
    "path": "/var/log/synapse/access.log",
    "offset": 65536,
    "data": "<base64-encoded-data>",
    "isLast": false,
    "sequence": 1
  }
}
```

### GET /api/v1/fleet/:sensorId/files/progress/:transferId

Get progress of an active file transfer.

**Required Scope:** `sensor:files`

**Response:**

```json
{
  "transferId": "550e8400-e29b-41d4-a716-446655440000",
  "sensorId": "sensor-prod-01",
  "path": "/var/log/synapse/access.log",
  "totalSize": 10485760,
  "transferred": 5242880,
  "percentage": 50,
  "bytesPerSecond": 1048576,
  "estimatedSecondsRemaining": 5,
  "elapsedMs": 5000
}
```

### Security Restrictions

- File paths are validated against strict allowlists on the sensor side
- Only specific directories are accessible (e.g., `/var/log/synapse`, `/etc/synapse`)
- All file access attempts are logged for audit purposes
- Maximum file size for direct download: 10 MB (larger files stream in chunks)

---

## Release Management (P2)

Manage firmware releases and coordinate rollouts to sensors.

### GET /api/v1/releases

List all releases with pagination.

**Required Scope:** `releases:read`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `50` | Max results (1-100) |
| `offset` | `number` | `0` | Pagination offset |
| `sort` | `string` | `createdAt` | Sort field: `version`, `createdAt`, `size` |
| `sortDir` | `string` | `desc` | Sort direction: `asc`, `desc` |

**Response:**

```json
{
  "releases": [
    {
      "id": "rel-001",
      "version": "0.2.0",
      "changelog": "Bug fixes and performance improvements",
      "binaryUrl": "https://releases.example.com/synapse-0.2.0.tar.gz",
      "sha256": "a1b2c3d4e5f6...",
      "size": 52428800,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "createdBy": "admin@example.com",
      "latestRollout": {
        "id": "roll-001",
        "status": "completed",
        "startedAt": "2026-01-15T12:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}
```

### POST /api/v1/releases

Create a new release.

**Required Scope:** `releases:write`

**Request Body:**

```json
{
  "version": "0.2.1",
  "changelog": "Security patch for CVE-2024-0001\n- Fixed authentication bypass\n- Updated dependencies",
  "binaryUrl": "https://releases.example.com/synapse-0.2.1.tar.gz",
  "sha256": "b2c3d4e5f6a7...",
  "size": 52500000
}
```

**Validation:**
- `version`: Valid semver (e.g., `1.0.0`, `1.0.0-beta.1`)
- `sha256`: 64-character hex string
- `size`: Maximum 500 MB

**Response:**

```json
{
  "id": "rel-002",
  "version": "0.2.1",
  "changelog": "Security patch for CVE-2024-0001...",
  "binaryUrl": "https://releases.example.com/synapse-0.2.1.tar.gz",
  "sha256": "b2c3d4e5f6a7...",
  "size": 52500000,
  "createdAt": "2026-01-16T10:00:00.000Z",
  "createdBy": "admin@example.com"
}
```

### GET /api/v1/releases/:id

Get release details including rollout history.

**Required Scope:** `releases:read`

**Response:**

```json
{
  "id": "rel-001",
  "version": "0.2.0",
  "changelog": "Bug fixes and performance improvements",
  "binaryUrl": "https://releases.example.com/synapse-0.2.0.tar.gz",
  "sha256": "a1b2c3d4e5f6...",
  "size": 52428800,
  "createdAt": "2026-01-15T10:00:00.000Z",
  "createdBy": "admin@example.com",
  "rollouts": [
    {
      "id": "roll-001",
      "strategy": "rolling",
      "status": "completed",
      "targetTags": ["production"],
      "batchSize": 10,
      "batchDelay": 60,
      "startedAt": "2026-01-15T12:00:00.000Z",
      "completedAt": "2026-01-15T14:30:00.000Z",
      "summary": {
        "total": 50,
        "pending": 0,
        "downloading": 0,
        "ready": 0,
        "activated": 48,
        "failed": 2
      }
    }
  ]
}
```

### POST /api/v1/releases/:id/rollout

Start a rollout for a release.

**Required Scope:** `releases:write`

**Request Body:**

```json
{
  "strategy": "rolling",
  "targetTags": ["production"],
  "sensorIds": null,
  "batchSize": 10,
  "batchDelay": 60
}
```

**Rollout Strategies:**

| Strategy | Description |
|----------|-------------|
| `immediate` | All sensors at once |
| `canary` | 10% of sensors first, then remaining |
| `rolling` | Batches of `batchSize` with `batchDelay` seconds between |

**Response:**

```json
{
  "rolloutId": "roll-002",
  "releaseVersion": "0.2.1",
  "strategy": "rolling",
  "targetSensors": 50,
  "status": "pending"
}
```

### GET /api/v1/releases/rollouts/:id

Get rollout status and progress.

**Required Scope:** `releases:read`

**Response:**

```json
{
  "id": "roll-002",
  "releaseId": "rel-002",
  "releaseVersion": "0.2.1",
  "strategy": "rolling",
  "status": "in_progress",
  "targetTags": ["production"],
  "batchSize": 10,
  "batchDelay": 60,
  "startedAt": "2026-01-16T12:00:00.000Z",
  "completedAt": null,
  "summary": {
    "total": 50,
    "pending": 30,
    "downloading": 5,
    "ready": 5,
    "activated": 10,
    "failed": 0
  },
  "progress": [
    {
      "id": "prog-001",
      "sensorId": "sensor-prod-01",
      "sensorName": "Production Sensor 01",
      "sensorRegion": "us-east-1",
      "currentVersion": "0.2.0",
      "status": "activated",
      "error": null,
      "updatedAt": "2026-01-16T12:05:00.000Z"
    }
  ]
}
```

**Rollout Status:**

| Status | Description |
|--------|-------------|
| `pending` | Rollout created, not yet started |
| `in_progress` | Rollout is actively updating sensors |
| `completed` | All sensors updated successfully |
| `failed` | Rollout failed (all sensors failed) |
| `cancelled` | Rollout was cancelled |

**Sensor Progress Status:**

| Status | Description |
|--------|-------------|
| `pending` | Waiting to start |
| `downloading` | Downloading release binary |
| `ready` | Download complete, ready to activate |
| `activated` | New version activated successfully |
| `failed` | Update failed |
| `cancelled` | Update cancelled |

### POST /api/v1/releases/rollouts/:id/cancel

Cancel an in-progress rollout.

**Required Scope:** `releases:write`

**Response:**

```json
{
  "id": "roll-002",
  "status": "cancelled",
  "message": "Rollout cancelled"
}
```

### GET /api/v1/releases/rollouts

List all rollouts with filtering.

**Required Scope:** `releases:read`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | `string` | Filter by status |
| `releaseId` | `string` | Filter by release ID |
| `limit` | `number` | Max results (default: 50) |
| `offset` | `number` | Pagination offset |

---

## Error Codes

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `202` | Accepted (async operation started) |
| `204` | No Content (successful delete) |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (missing/invalid API key) |
| `403` | Forbidden (insufficient scopes) |
| `404` | Not Found |
| `409` | Conflict (duplicate resource) |
| `428` | Precondition Required (missing confirmation) |
| `500` | Internal Server Error |
| `502` | Bad Gateway (tunnel communication error) |
| `503` | Service Unavailable (sensor offline) |
| `504` | Gateway Timeout (operation timed out) |

### Error Response Format

```json
{
  "error": "Error type",
  "message": "Human-readable description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `SENSOR_NOT_FOUND` | Sensor does not exist or not accessible | Verify sensor ID and tenant access |
| `SENSOR_OFFLINE` | Sensor is not connected | Wait for sensor to reconnect |
| `TUNNEL_NOT_CONNECTED` | WebSocket tunnel not established | Check sensor connectivity |
| `RATE_LIMITED` | Rate limit exceeded | Reduce request frequency |
| `INSUFFICIENT_SCOPE` | API key lacks required scope | Request key with additional scopes |
| `CONFIRMATION_REQUIRED` | Destructive operation needs confirmation | Include X-Confirm-Token header |
| `TIMEOUT` | Operation timed out | Increase timeout or retry |
| `PATH_NOT_ALLOWED` | File path not in allowlist | Use allowed paths only |

---

## Rate Limits by Channel

| Channel | Messages/sec | Bytes/sec | Max Sessions/Sensor |
|---------|-------------|-----------|---------------------|
| Shell | 100 | 655,360 | 3 |
| Logs | 500 | 1,048,576 | 5 |
| Diagnostics | 10 | 524,288 | 2 |
| Control | 5 | 65,536 | 1 |
| Files | 50 | 5,242,880 | 2 |

---

## Audit Logging

All remote management operations are logged for security and compliance:

- Control commands (with reason, result, duration)
- File access operations (path, success/failure)
- Shell session lifecycle
- Release deployments

Audit logs include:
- Timestamp
- Tenant ID
- User ID / API Key ID
- Operation details
- Client IP address
- User agent
- Result and duration

---

## Troubleshooting

### Sensor Not Responding

1. Check sensor connection state: `GET /api/v1/fleet/:sensorId`
2. Verify heartbeat is recent (< 2 minutes)
3. Check tunnel status: `GET /api/v1/tunnel/status/:sensorId`
4. Review sensor logs for connectivity issues

### Rate Limiting

If receiving `429` or rate limit errors:
1. Reduce request frequency
2. Batch operations where possible
3. Use SSE endpoints for continuous data instead of polling

### File Transfer Failures

1. Verify path is in allowed directories
2. Check file size against limits
3. Use chunked download for large files
4. Retry with increased timeout

### Control Commands Failing

1. Verify required scopes on API key
2. For destructive commands, include `X-Confirm-Token`
3. Check sensor is online and not draining
4. Review audit log for failure reasons
