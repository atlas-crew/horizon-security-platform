# Signal Horizon API

Comprehensive API documentation for the Signal Horizon Hub (REST + WebSocket).

## Base URL and Versioning

- REST base path: `/api/v1`
- Health checks: `/health`, `/ready`
- Hub status: `/api/v1/status`
- WebSocket paths are configurable (defaults below):
  - Sensor gateway: `/ws/sensors`
  - Dashboard gateway: `/ws/dashboard`

All timestamps are ISO 8601 strings in UTC when serialized in JSON responses.

## Authentication

All `/api/v1/*` routes require an API key **except** `/api/v1/status`.

Use the `Authorization` header with a Bearer token:

```
Authorization: Bearer <api-key>
```

The API key is validated against the `api_keys` table using a SHA-256 hash.

### Scopes

These scopes are enforced at the route level:

- `dashboard:read` - Read access to campaigns, threats, war rooms, intel, and blocklist
- `dashboard:write` - Create/update war rooms and campaign status
- `signal:write` - Required for sensor WebSocket auth and blocklist checks
- `blocklist:write` - Manage blocklist entries
- `fleet:read` - Fleet metrics, sensors, commands, and rule status
- `fleet:write` - Send commands and rule pushes
- `fleet:admin` - Fleet-wide access (cross-tenant), required for some actions
- `config:read` - Read config templates
- `config:write` - Create/update/delete/push config templates

### Tenant Visibility Rules

- Non-fleet-admin keys are tenant-scoped.
- Fleet admins (`fleet:admin`) can access fleet-wide data and cross-tenant views where supported.
- Cross-tenant campaigns and fleet threats are visible to all tenants; tenant-specific data is isolated.

## Response Conventions

- JSON responses are standard for REST endpoints unless otherwise noted.
- Validation errors return HTTP 400 with a structured `details` array.
- Auth errors return 401 or 403.
- Pagination uses `limit` and `offset` with a `pagination` object.

### Error Shape

Typical error response:

```json
{
  "error": "Invalid request body",
  "details": [
    { "path": "name", "message": "Required" }
  ]
}
```

### Rate Limiting

Hunt endpoints use in-memory rate limiting and return:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (on 429)

Configured limits:

- Hunt queries: 100 requests/minute
- Saved queries: 30 requests/minute
- Heavy aggregations: 10 requests/minute

## Data Models (Core)

These are the canonical shapes returned by the API unless noted otherwise.

### Campaign

```json
{
  "id": "string",
  "tenantId": "string | null",
  "name": "string",
  "description": "string | null",
  "status": "ACTIVE | MONITORING | RESOLVED | FALSE_POSITIVE",
  "severity": "LOW | MEDIUM | HIGH | CRITICAL",
  "isCrossTenant": true,
  "tenantsAffected": 2,
  "confidence": 0.92,
  "correlationSignals": { "...": "..." },
  "firstSeenAt": "2025-01-01T00:00:00Z",
  "lastActivityAt": "2025-01-01T00:05:00Z",
  "resolvedAt": "2025-01-02T00:00:00Z | null",
  "resolvedBy": "string | null",
  "metadata": { "...": "..." },
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:05:00Z"
}
```

### Threat

```json
{
  "id": "string",
  "tenantId": "string | null",
  "threatType": "IP | FINGERPRINT | ASN | USER_AGENT | TLS_FINGERPRINT | CREDENTIAL_PATTERN",
  "indicator": "string",
  "anonIndicator": "string | null",
  "riskScore": 87.2,
  "fleetRiskScore": 91.0,
  "firstSeenAt": "2025-01-01T00:00:00Z",
  "lastSeenAt": "2025-01-01T01:00:00Z",
  "hitCount": 120,
  "tenantsAffected": 3,
  "isFleetThreat": true,
  "ttl": "2025-01-08T00:00:00Z | null",
  "metadata": { "...": "..." },
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T01:00:00Z"
}
```

### BlocklistEntry

```json
{
  "id": "string",
  "tenantId": "string | null",
  "threatId": "string | null",
  "blockType": "IP | IP_RANGE | FINGERPRINT | ASN | USER_AGENT",
  "indicator": "string",
  "source": "AUTOMATIC | MANUAL | FLEET_INTEL | EXTERNAL_FEED | WAR_ROOM",
  "reason": "string | null",
  "expiresAt": "2025-01-02T00:00:00Z | null",
  "propagatedAt": "2025-01-02T00:05:00Z | null",
  "propagationStatus": "PENDING | IN_PROGRESS | COMPLETED | FAILED | PARTIAL",
  "sensorsNotified": 12,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### WarRoom

```json
{
  "id": "string",
  "tenantId": "string",
  "name": "string",
  "description": "string | null",
  "status": "ACTIVE | PAUSED | CLOSED | ARCHIVED",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "leaderId": "string | null",
  "createdAt": "2025-01-01T00:00:00Z",
  "closedAt": "2025-01-02T00:00:00Z | null",
  "updatedAt": "2025-01-01T00:05:00Z"
}
```

### WarRoomActivity

```json
{
  "id": "string",
  "warRoomId": "string",
  "tenantId": "string",
  "actorType": "USER | HORIZON_BOT | SYSTEM",
  "actorId": "string | null",
  "actorName": "string",
  "actionType": "MESSAGE | BLOCK_CREATED | BLOCK_REMOVED | CAMPAIGN_LINKED | STATUS_CHANGED | PRIORITY_CHANGED | MEMBER_JOINED | MEMBER_LEFT | ALERT_TRIGGERED",
  "description": "string",
  "metadata": { "...": "..." },
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### FleetMetrics

```json
{
  "totalSensors": 10,
  "onlineSensors": 9,
  "offlineSensors": 1,
  "totalRps": 12500,
  "avgLatency": 18.4,
  "healthScore": 90.0,
  "avgCpu": 44.1,
  "avgMemory": 62.3,
  "avgDisk": 41.8,
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### Sensor (Fleet)

```json
{
  "id": "string",
  "tenantId": "string",
  "name": "string",
  "hostname": "string | null",
  "region": "string",
  "version": "string",
  "connectionState": "CONNECTED | DISCONNECTED | RECONNECTING",
  "lastHeartbeat": "2025-01-01T00:00:00Z | null",
  "lastSignalAt": "2025-01-01T00:00:00Z | null",
  "signalsReported": 120,
  "blocksApplied": 15,
  "ipAddress": "string | null",
  "metadata": { "...": "..." },
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:05:00Z"
}
```

### FleetCommand

```json
{
  "id": "string",
  "sensorId": "string",
  "commandType": "string",
  "payload": { "...": "..." },
  "status": "pending | sent | success | failed | timeout",
  "result": { "...": "..." },
  "error": "string | null",
  "queuedAt": "2025-01-01T00:00:00Z",
  "sentAt": "2025-01-01T00:00:10Z | null",
  "completedAt": "2025-01-01T00:00:30Z | null",
  "attempts": 1,
  "timeoutAt": "2025-01-01T00:01:00Z"
}
```

### ConfigTemplate

```json
{
  "id": "string",
  "name": "string",
  "description": "string | null",
  "environment": "production | staging | dev",
  "config": { "...": "..." },
  "hash": "string",
  "version": "string",
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:05:00Z"
}
```

### HuntSignalResult

```json
{
  "id": "string",
  "timestamp": "2025-01-01T00:00:00Z",
  "tenantId": "string",
  "sensorId": "string",
  "signalType": "IP_THREAT | FINGERPRINT_THREAT | CAMPAIGN_INDICATOR | CREDENTIAL_STUFFING | RATE_ANOMALY | BOT_SIGNATURE | IMPOSSIBLE_TRAVEL",
  "sourceIp": "string | null",
  "anonFingerprint": "string | null",
  "severity": "LOW | MEDIUM | HIGH | CRITICAL",
  "confidence": 0.92,
  "eventCount": 15
}
```

## Public Endpoints

### GET /health

Health check (no auth).

Response:

```json
{
  "status": "healthy",
  "service": "signal-horizon-hub",
  "version": "0.1.0",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### GET /ready

Readiness check, including database and ClickHouse connectivity (no auth).

Response (ready):

```json
{
  "status": "ready",
  "database": "connected",
  "clickhouse": "connected | disabled | disconnected",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

Response (not ready):

```json
{
  "status": "not_ready",
  "database": "disconnected",
  "error": "string"
}
```

### GET /api/v1/status

Hub status (no auth).

Response:

```json
{
  "hub": "signal-horizon",
  "version": "0.1.0",
  "uptime": 123.45,
  "connections": {
    "sensors": 12,
    "dashboards": 3
  }
}
```

## REST API

### Campaigns

#### GET /api/v1/campaigns

List campaigns (tenant scoped unless fleet admin).

Scopes: `dashboard:read`

Query:
- `status` (optional): ACTIVE | MONITORING | RESOLVED | FALSE_POSITIVE
- `severity` (optional): LOW | MEDIUM | HIGH | CRITICAL
- `limit` (default 50, max 100)
- `offset` (default 0)

Response:

```json
{
  "campaigns": [
    {
      "id": "cmp-123",
      "name": "Fleet Campaign 1a2b3c4d",
      "status": "ACTIVE",
      "severity": "HIGH",
      "isCrossTenant": true,
      "tenantsAffected": 3,
      "lastActivityAt": "2025-01-01T00:05:00Z"
    }
  ],
  "pagination": { "total": 120, "limit": 50, "offset": 0 }
}
```

#### GET /api/v1/campaigns/:id

Get a single campaign by ID.

Scopes: `dashboard:read`

Response: `Campaign`

#### PATCH /api/v1/campaigns/:id

Update campaign status.

Scopes: `dashboard:write` or `fleet:admin`

Body:

```json
{
  "status": "ACTIVE | MONITORING | RESOLVED | FALSE_POSITIVE"
}
```

Response: `Campaign`

Notes:
- Cross-tenant campaigns can only be updated by fleet admins.

---

### Threats

#### GET /api/v1/threats

List threats (tenant scoped unless fleet admin).

Scopes: `dashboard:read`

Query:
- `threatType` (optional)
- `isFleetThreat` (optional, "true" | "false")
- `minRiskScore` (optional, 0-100)
- `maxRiskScore` (optional, 0-100)
- `limit` (default 50, max 100)
- `offset` (default 0)

Response:

```json
{
  "threats": [
    {
      "id": "thr-123",
      "threatType": "IP",
      "indicator": "1.2.3.4",
      "riskScore": 82.5,
      "isFleetThreat": true,
      "lastSeenAt": "2025-01-01T00:05:00Z"
    }
  ],
  "pagination": { "total": 120, "limit": 50, "offset": 0 }
}
```

#### GET /api/v1/threats/search

Search threats by indicator substring.

Scopes: `dashboard:read`

Query:
- `q` (required, min 2 chars)
- `type` (optional)
- `limit` (default 20, max 50)

Response:

```json
{
  "threats": [
    {
      "id": "string",
      "threatType": "string",
      "indicator": "string",
      "riskScore": 75,
      "hitCount": 99,
      "isFleetThreat": true,
      "lastSeenAt": "2025-01-01T00:00:00Z"
    }
  ],
  "query": "example"
}
```

#### GET /api/v1/threats/:id

Get a single threat by ID.

Scopes: `dashboard:read`

Response: `Threat`

---

### Blocklist

#### GET /api/v1/blocklist

List blocklist entries (tenant scoped unless fleet admin).

Scopes: `dashboard:read`

Query:
- `blockType` (optional): IP | IP_RANGE | FINGERPRINT | ASN | USER_AGENT
- `source` (optional): AUTOMATIC | MANUAL | FLEET_INTEL | EXTERNAL_FEED | WAR_ROOM
- `limit` (default 100, max 500)
- `offset` (default 0)

Response:

```json
{
  "entries": [
    {
      "id": "blk-123",
      "blockType": "IP",
      "indicator": "1.2.3.4",
      "source": "MANUAL",
      "propagationStatus": "PENDING",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": { "total": 120, "limit": 100, "offset": 0 }
}
```

#### POST /api/v1/blocklist

Add or update a blocklist entry.

Scopes: `blocklist:write` or `fleet:admin`

Body:

```json
{
  "blockType": "IP | IP_RANGE | FINGERPRINT | ASN | USER_AGENT",
  "indicator": "string",
  "reason": "string (optional)",
  "expiresAt": "2025-01-02T00:00:00Z (optional)",
  "fleetWide": false
}
```

Response: `BlocklistEntry`

Notes:
- `fleetWide: true` requires `fleet:admin`.
- Upserts by (blockType, indicator, tenantId).

#### DELETE /api/v1/blocklist/:id

Remove a blocklist entry.

Scopes: `blocklist:write` or `fleet:admin`

Response: HTTP 204 No Content

#### GET /api/v1/blocklist/check

Check if an indicator is blocked for the calling tenant.

Scopes: `dashboard:read` or `signal:write`

Query:
- `indicator` (required)
- `blockType` (optional)

Response:

```json
{
  "blocked": true,
  "entry": {
    "id": "blk-123",
    "blockType": "IP",
    "indicator": "1.2.3.4",
    "source": "MANUAL",
    "propagationStatus": "PENDING",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

If not blocked, `entry` may be omitted.

---

### War Rooms

#### GET /api/v1/warrooms

List war rooms for the tenant.

Scopes: `dashboard:read`

Query:
- `status` (optional): ACTIVE | PAUSED | CLOSED | ARCHIVED
- `limit` (default 50, max 100)
- `offset` (default 0)

Response:

```json
{
  "warRooms": [
    {
      "id": "wr-123",
      "tenantId": "tenant-123",
      "name": "Incident: Fleet Campaign 1a2b3c4d",
      "status": "ACTIVE",
      "priority": "HIGH",
      "_count": { "activities": 12, "campaignLinks": 2 }
    }
  ],
  "pagination": { "total": 12, "limit": 50, "offset": 0 }
}
```

#### POST /api/v1/warrooms

Create a war room.

Scopes: `dashboard:write`

Body:

```json
{
  "name": "string",
  "description": "string (optional)",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL (optional)",
  "campaignIds": ["campaign-id"]
}
```

Response: `WarRoom`

#### GET /api/v1/warrooms/:id

Get war room details with recent activities.

Scopes: `dashboard:read`

Response:

```json
{
  "id": "wr-123",
  "tenantId": "tenant-123",
  "name": "Incident: Fleet Campaign 1a2b3c4d",
  "status": "ACTIVE",
  "priority": "HIGH",
  "activities": [
    {
      "id": "wra-123",
      "actorType": "SYSTEM",
      "actorName": "System",
      "actionType": "STATUS_CHANGED",
      "description": "War room created",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "_count": { "activities": 12, "campaignLinks": 2 }
}
```

#### PATCH /api/v1/warrooms/:id

Update war room status or priority.

Scopes: `dashboard:write`

Body:

```json
{
  "status": "ACTIVE | PAUSED | CLOSED | ARCHIVED (optional)",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL (optional)"
}
```

Response: `WarRoom`

#### GET /api/v1/warrooms/:id/activities

Paginated activities for a war room.

Scopes: `dashboard:read`

Query:
- `limit` (default 50, max 200)
- `cursor` (optional activity ID)

Response:

```json
{
  "activities": [
    {
      "id": "wra-123",
      "actorType": "USER",
      "actorName": "Analyst",
      "actionType": "MESSAGE",
      "description": "Investigating burst in EU region",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "nextCursor": "activity-id | null"
}
```

#### POST /api/v1/warrooms/:id/messages

Add a message to the war room timeline.

Scopes: `dashboard:write`

Body:

```json
{ "message": "string" }
```

Response: `WarRoomActivity`

#### POST /api/v1/warrooms/:id/blocks

Create a blocklist entry from a war room.

Scopes: `dashboard:write`

Body:

```json
{
  "blockType": "IP | IP_RANGE | FINGERPRINT | ASN | USER_AGENT",
  "indicator": "string",
  "reason": "string (optional)",
  "expiresAt": "2025-01-02T00:00:00Z (optional)"
}
```

Response:

```json
{ "success": true }
```

#### DELETE /api/v1/warrooms/:id/blocks

Remove a blocklist entry created by a war room.

Scopes: `dashboard:write`

Body:

```json
{
  "blockType": "IP | IP_RANGE | FINGERPRINT | ASN | USER_AGENT",
  "indicator": "string"
}
```

Response:

```json
{ "success": true }
```

#### POST /api/v1/warrooms/:id/campaigns

Link campaigns to a war room.

Scopes: `dashboard:write`

Body:

```json
{ "campaignIds": ["campaign-id"] }
```

Response:

```json
{ "success": true }
```

#### GET /api/v1/warrooms/:id/campaigns

List campaigns linked to a war room.

Scopes: `dashboard:read`

Response:

```json
{
  "campaigns": [
    {
      "id": "cmp-123",
      "name": "Fleet Campaign 1a2b3c4d",
      "status": "ACTIVE",
      "severity": "HIGH",
      "isCrossTenant": true
    }
  ]
}
```

#### GET /api/v1/warrooms/stats

War room stats for the tenant.

Scopes: `dashboard:read`

Response:

```json
{
  "activeWarRooms": 3,
  "activitiesLast24h": 120,
  "blocksCreatedLast24h": 4
}
```

---

### Intel

#### GET /api/v1/intel/iocs

Export IOCs.

Scopes: `dashboard:read`

Query:
- `format` (json | csv | stix, default json)
- `from` (optional ISO date)
- `to` (optional ISO date)
- `threatTypes` (optional comma-separated list)
- `minRiskScore` (optional 0-100)
- `fleetOnly` (optional boolean)
- `limit` (default 1000, max 10000)

Response:
- JSON or STIX: `application/json`
- CSV: `text/csv` with `Content-Disposition`

#### GET /api/v1/intel/trends

Attack volume trends.

Scopes: `dashboard:read`

Query:
- `windowHours` (1-720, default 24)

Response:

```json
{
  "timeRange": { "from": "...", "to": "..." },
  "totalSignals": 123,
  "totalThreats": 45,
  "totalBlocks": 12,
  "signalsByType": { "IP_THREAT": 40 },
  "signalsBySeverity": { "HIGH": 10 },
  "volumeOverTime": [ { "timestamp": "...", "value": 10 } ],
  "topIPs": [ { "ip": "1.2.3.4", "count": 10, "riskScore": 80 } ],
  "topFingerprints": [ { "ip": "...", "count": 5, "riskScore": 70 } ],
  "topCampaigns": [ { "id": "...", "name": "...", "severity": "HIGH", "hitCount": 12 } ]
}
```

#### GET /api/v1/intel/fleet-summary

Fleet-wide intelligence summary.

Scopes: `fleet:admin`

Response:

```json
{
  "activeSensors": 12,
  "totalThreats": 120,
  "fleetThreats": 45,
  "crossTenantCampaigns": 6,
  "blockedIndicators": 33,
  "signalsLast24h": 900,
  "topAttackTypes": [ { "type": "IP_THREAT", "count": 120, "percentage": 30 } ]
}
```

#### GET /api/v1/intel/blocklist

Export blocklist entries.

Scopes: `dashboard:read`

Query:
- `format` (json | csv | plain, default json)
- `fleetOnly` (optional boolean)

Response:
- JSON: `application/json`
- CSV: `text/csv` with `Content-Disposition`
- Plain: `text/plain`

#### GET /api/v1/intel/top-threats

Top threats by dimension.

Scopes: `dashboard:read`

Query:
- `windowHours` (1-720, default 24)

Response:

```json
{
  "timeRange": { "from": "...", "to": "..." },
  "topIPs": [ { "ip": "1.2.3.4", "count": 10, "riskScore": 80 } ],
  "topFingerprints": [ { "ip": "...", "count": 5, "riskScore": 70 } ],
  "topCampaigns": [ { "id": "...", "name": "...", "severity": "HIGH", "hitCount": 12 } ]
}
```

#### GET /api/v1/intel/signals-by-type

Signal breakdown by type and severity.

Scopes: `dashboard:read`

Query:
- `windowHours` (1-720, default 24)

Response:

```json
{
  "timeRange": { "from": "...", "to": "..." },
  "signalsByType": { "IP_THREAT": 40 },
  "signalsBySeverity": { "HIGH": 10 },
  "total": 120
}
```

#### GET /api/v1/intel/volume-chart

Time-series data points for volume charts.

Scopes: `dashboard:read`

Query:
- `windowHours` (1-720, default 24)

Response:

```json
{
  "timeRange": { "from": "...", "to": "..." },
  "dataPoints": [ { "timestamp": "...", "value": 10 } ]
}
```

---

### Hunt

#### GET /api/v1/hunt/status

Check whether historical hunting (ClickHouse) is available.

Auth: API key required (no scope check)

Response:

```json
{
  "historical": true,
  "routingThreshold": "24h",
  "description": "Historical queries via ClickHouse enabled"
}
```

#### POST /api/v1/hunt/query

Query signal timeline with automatic routing.

Auth: API key required (no scope check)

Body:

```json
{
  "tenantId": "string (optional)",
  "startTime": "2025-01-01T00:00:00Z",
  "endTime": "2025-01-01T01:00:00Z",
  "signalTypes": ["IP_THREAT", "BOT_SIGNATURE"],
  "sourceIps": ["1.2.3.4"],
  "severities": ["HIGH"],
  "minConfidence": 0.8,
  "anonFingerprint": "64-char-hash",
  "limit": 1000,
  "offset": 0
}
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "sig-123",
      "timestamp": "2025-01-01T00:00:00Z",
      "tenantId": "tenant-123",
      "sensorId": "sensor-123",
      "signalType": "IP_THREAT",
      "sourceIp": "1.2.3.4",
      "anonFingerprint": "abc123...",
      "severity": "HIGH",
      "confidence": 0.9,
      "eventCount": 10
    }
  ],
  "meta": {
    "total": 1200,
    "source": "postgres | clickhouse | hybrid",
    "queryTimeMs": 123,
    "limit": 1000,
    "offset": 0
  }
}
```

#### GET /api/v1/hunt/timeline/:campaignId

Get campaign event timeline (ClickHouse required).

Query:
- `startTime` (optional)
- `endTime` (optional)

Response:

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-01-01T00:00:00Z",
      "campaignId": "string",
      "eventType": "created | updated | escalated | resolved",
      "name": "string",
      "status": "string",
      "severity": "string",
      "isCrossTenant": true,
      "tenantsAffected": 2,
      "confidence": 0.9
    }
  ],
  "meta": { "campaignId": "string", "count": 1 }
}
```

If ClickHouse is disabled, returns HTTP 503.

#### GET /api/v1/hunt/stats/hourly

Get hourly aggregated statistics (ClickHouse required).

Query:
- `tenantId` (optional)
- `startTime` (optional)
- `endTime` (optional)
- `signalTypes` (optional, repeatable query param)

Response:

```json
{
  "success": true,
  "data": [
    {
      "hour": "2025-01-01T00:00:00Z",
      "tenantId": "string",
      "signalType": "IP_THREAT",
      "severity": "HIGH",
      "signalCount": 100,
      "totalEvents": 120,
      "uniqueIps": 20,
      "uniqueFingerprints": 5
    }
  ],
  "meta": { "count": 1 }
}
```

#### POST /api/v1/hunt/ip-activity

Get IP activity across tenants.

Body:

```json
{ "sourceIp": "1.2.3.4", "days": 30 }
```

Response:

```json
{
  "success": true,
  "data": {
    "totalHits": 120,
    "tenantsHit": 3,
    "firstSeen": "2025-01-01T00:00:00Z",
    "lastSeen": "2025-01-01T01:00:00Z",
    "signalTypes": ["IP_THREAT"]
  },
  "meta": { "sourceIp": "1.2.3.4", "lookbackDays": 30 }
}
```

#### Saved Queries

Saved queries are currently stored **in memory** (demo mode) and are not durable across restarts.

- GET /api/v1/hunt/saved-queries
- POST /api/v1/hunt/saved-queries
- GET /api/v1/hunt/saved-queries/:id
- POST /api/v1/hunt/saved-queries/:id/run
- DELETE /api/v1/hunt/saved-queries/:id

**List saved queries**

Query:
- `createdBy` (optional)

Response:

```json
{ "success": true, "data": ["SavedQuery"], "meta": { "count": 2 } }
```

**Create a saved query**

Body:

```json
{
  "name": "string",
  "description": "string (optional)",
  "query": { "...": "same shape as /hunt/query" }
}
```

Response:

```json
{ "success": true, "data": { "id": "...", "name": "...", "query": {"...": "..."} } }
```

**Run a saved query** returns the same shape as `/hunt/query`.

---

### Fleet Management

#### GET /api/v1/fleet

Fleet-wide aggregated metrics.

Scopes: `fleet:read`

Response: `FleetMetrics`

#### GET /api/v1/fleet/sensors

List sensors for the tenant.

Scopes: `fleet:read`

Query:
- `status` (optional): CONNECTED | DISCONNECTED | RECONNECTING
- `limit` (default 50, max 100)
- `offset` (default 0)

Response:

```json
{
  "sensors": [
    {
      "id": "sensor-123",
      "name": "Edge Sensor US-E",
      "connectionState": "CONNECTED",
      "version": "1.2.3",
      "lastHeartbeat": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": { "total": 10, "limit": 50, "offset": 0 }
}
```

#### GET /api/v1/fleet/sensors/:sensorId

Get detailed sensor info (includes recent commands).

Scopes: `fleet:read`

Response:

```json
{
  "id": "sensor-123",
  "name": "Edge Sensor US-E",
  "connectionState": "CONNECTED",
  "version": "1.2.3",
  "commands": [
    {
      "id": "cmd-123",
      "commandType": "push_config",
      "status": "pending",
      "queuedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### GET /api/v1/fleet/alerts

Sensors requiring attention + recent failed commands.

Scopes: `fleet:read`

Response:

```json
{
  "offlineSensors": [
    {
      "id": "sensor-456",
      "name": "Edge Sensor EU-W",
      "connectionState": "DISCONNECTED",
      "lastHeartbeat": "2025-01-01T00:00:00Z",
      "metadata": { "cpu": 92 }
    }
  ],
  "recentFailures": [
    {
      "id": "cmd-456",
      "commandType": "push_rules",
      "status": "failed",
      "error": "Timeout"
    }
  ]
}
```

#### Config Templates

- GET /api/v1/fleet/config/templates (config:read)
- POST /api/v1/fleet/config/templates (config:write)
- GET /api/v1/fleet/config/templates/:id (config:read)
- PUT /api/v1/fleet/config/templates/:id (config:write)
- DELETE /api/v1/fleet/config/templates/:id (config:write)

**Create/Update Body**

```json
{
  "name": "string",
  "description": "string (optional)",
  "environment": "string (default: production)",
  "config": { "...": "..." }
}
```

Responses return `ConfigTemplate` objects.

#### POST /api/v1/fleet/config/push

Push a config template to sensors.

Scopes: `config:write`

Body:

```json
{ "templateId": "string", "sensorIds": ["sensor-id"] }
```

Response:

```json
{ "message": "Configuration push initiated", "commands": ["commandId"] }
```

#### Commands

- GET /api/v1/fleet/commands (fleet:read)
- POST /api/v1/fleet/commands (fleet:write)
- GET /api/v1/fleet/commands/:commandId (fleet:read)
- POST /api/v1/fleet/commands/:commandId/cancel (fleet:write)

**List commands**

Query:
- `status` (optional)
- `limit` (default 50, max 100)
- `offset` (default 0)

Response:

```json
{
  "commands": [
    {
      "id": "cmd-123",
      "sensorId": "sensor-123",
      "commandType": "push_config",
      "status": "pending",
      "queuedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": { "total": 10, "limit": 50, "offset": 0 }
}
```

**Send commands**

Body:

```json
{
  "commandType": "string",
  "sensorIds": ["sensor-id"],
  "payload": { "...": "..." }
}
```

Response:

```json
{ "message": "Commands queued for delivery", "commands": ["commandId"] }
```

**Cancel command** only works if the command status is `pending`.

#### Rules

- GET /api/v1/fleet/rules/status (fleet:read)
- POST /api/v1/fleet/rules/push (fleet:write)
- POST /api/v1/fleet/rules/retry/:sensorId (fleet:write)

**Get rule status**

Response:

```json
{
  "status": [
    {
      "sensorId": "string",
      "sensorName": "string",
      "syncedRules": 10,
      "syncStatus": [ { "ruleId": "string", "status": "pending | synced | failed" } ]
    }
  ]
}
```

**Push rules**

Body:

```json
{
  "ruleIds": ["rule-id"],
  "sensorIds": ["sensor-id"],
  "strategy": "immediate | canary | scheduled",
  "canaryPercentage": 10,
  "scheduledTime": "2025-01-01T00:00:00Z"
}
```

Response:

```json
{ "message": "Rule distribution initiated", "deployment": { "...": "..." } }
```

**Retry failed rules**

Response:

```json
{ "message": "Rule retry initiated", "retriedRules": ["rule-id"] }
```

---

## WebSocket Protocols

### Sensor Gateway (Inbound)

- Path: `/ws/sensors` (configurable)
- Auth: API key with `signal:write` scope
- Auth timeout: 10 seconds
- Rate limit: 100 messages per second per connection (sliding window)

#### Client -> Hub Messages

```json
{ "type": "auth", "payload": { "apiKey": "...", "sensorId": "...", "sensorName": "...", "version": "1.2.3" } }
```

```json
{ "type": "signal", "payload": { "signalType": "IP_THREAT", "sourceIp": "1.2.3.4", "severity": "HIGH", "confidence": 0.92, "eventCount": 1, "metadata": {} } }
```

```json
{ "type": "signal-batch", "payload": [ { "signalType": "IP_THREAT", "severity": "HIGH", "confidence": 0.92 } ] }
```

```json
{ "type": "blocklist-sync" }
```

```json
{ "type": "pong" }
```

```json
{ "type": "heartbeat", "payload": { "timestamp": 1735689600000, "status": "healthy", "cpu": 40, "memory": 60, "disk": 30, "requestsLastMinute": 1200, "avgLatencyMs": 18, "configHash": "...", "rulesHash": "..." } }
```

```json
{ "type": "command-ack", "payload": { "commandId": "cmd-123", "success": true, "message": "ok", "result": { "...": "..." } } }
```

Notes:
- `signal-batch` max size is 1000.
- `version` must be semver (`x.y.z`).
- The current validation schema only accepts: `auth`, `signal`, `signal-batch`, `pong`, `blocklist-sync`.
  `heartbeat` and `command-ack` are handled by the gateway but are not in the schema yet.

#### Hub -> Client Messages

```json
{ "type": "auth-success", "sensorId": "...", "tenantId": "...", "capabilities": ["signal", "blocklist-sync"] }
```

```json
{ "type": "auth-failed", "error": "Invalid API key" }
```

```json
{ "type": "signal-ack", "sequenceId": 1 }
```

```json
{ "type": "batch-ack", "count": 100, "sequenceId": 2 }
```

```json
{ "type": "blocklist-snapshot", "entries": [ { "blockType": "IP", "indicator": "1.2.3.4", "expiresAt": null, "source": "MANUAL" } ], "sequenceId": 3 }
```

```json
{ "type": "ping", "timestamp": 1735689600000 }
```

```json
{ "type": "error", "error": "Invalid message" }
```

#### Hub -> Sensor Commands

Commands are sent as raw WebSocket messages:

```json
{ "type": "push_config", "commandId": "cmd-123", "payload": { "...": "..." } }
```

Supported command types:
- `push_config`
- `push_rules`
- `restart`
- `collect_diagnostics`

### Dashboard Gateway (Outbound)

- Path: `/ws/dashboard` (configurable)
- Auth: API key with `dashboard:read` scope
- Fleet admins receive fleet-wide data and can see all tenants.

#### Client -> Hub Messages

```json
{ "type": "auth", "payload": { "apiKey": "..." } }
```

```json
{ "type": "subscribe", "payload": { "topic": "campaigns | threats | blocklist | metrics" } }
```

```json
{ "type": "unsubscribe", "payload": { "topic": "campaigns | threats | blocklist | metrics" } }
```

```json
{ "type": "request-snapshot" }
```

```json
{ "type": "pong" }
```

#### Hub -> Client Messages

```json
{ "type": "auth-required", "message": "Please authenticate with an API key", "timestamp": 1735689600000 }
```

```json
{ "type": "auth-success", "sessionId": "...", "tenantId": "...", "isFleetAdmin": false, "subscriptions": ["campaigns", "threats", "blocklist"], "timestamp": 1735689600000 }
```

```json
{
  "type": "snapshot",
  "data": {
    "activeCampaigns": [
      { "id": "cmp-123", "name": "Fleet Campaign 1a2b3c4d", "status": "ACTIVE" }
    ],
    "recentThreats": [
      { "id": "thr-123", "threatType": "IP", "indicator": "1.2.3.4", "riskScore": 80 }
    ],
    "sensorStats": { "CONNECTED": 3 }
  },
  "timestamp": 1735689600000,
  "sequenceId": 1
}
```

```json
{ "type": "campaign-alert", "data": { "type": "campaign-detected", "campaign": { "id": "...", "name": "...", "severity": "HIGH", "isCrossTenant": true, "tenantsAffected": 2, "confidence": 0.9 } }, "timestamp": 1735689600000, "sequenceId": 2 }
```

```json
{ "type": "threat-alert", "data": { "threat": { "id": "...", "threatType": "IP", "indicator": "1.2.3.4", "riskScore": 80, "isFleetThreat": true } }, "timestamp": 1735689600000, "sequenceId": 3 }
```

```json
{ "type": "blocklist-update", "data": { "updates": [ { "type": "add", "blockType": "IP", "indicator": "1.2.3.4", "reason": "...", "source": "FLEET_INTEL" } ], "campaign": "campaign-id" }, "timestamp": 1735689600000, "sequenceId": 4 }
```

```json
{ "type": "ping", "timestamp": 1735689600000 }
```

```json
{ "type": "error", "error": "Invalid message", "timestamp": 1735689600000 }
```

Notes:
- Default subscriptions after auth: `campaigns`, `threats`, `blocklist`.
- The `metrics` topic is accepted by schema but no server-side broadcasts are currently emitted for it.

## Known Constraints

- ClickHouse-backed endpoints return HTTP 503 when ClickHouse is disabled.
- Saved queries are in-memory only and reset on restart.
- Sensor message validation currently does not include `heartbeat` or `command-ack`.
