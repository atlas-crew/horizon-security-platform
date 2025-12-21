# Hunt API Documentation

The Hunt API enables time-based threat hunting across Signal Horizon's fleet intelligence data. It provides intelligent query routing between PostgreSQL (real-time) and ClickHouse (historical) based on time range.

## Overview

### Query Routing Strategy

| Time Range | Data Source | Use Case |
|------------|-------------|----------|
| < 24 hours | PostgreSQL | Real-time threat investigation |
| > 24 hours | ClickHouse | Historical analysis, forensics |
| Spanning 24h threshold | Hybrid (both) | Cross-period investigation |

### Performance Targets

- **90-day query p95**: < 2 seconds
- **Ingestion throughput**: 10K signals/sec
- **Storage efficiency**: < 100 bytes/signal (compressed)

## Configuration

Enable ClickHouse for historical queries by setting environment variables:

```bash
CLICKHOUSE_ENABLED=true
CLICKHOUSE_HOST=clickhouse
CLICKHOUSE_HTTP_PORT=8123
CLICKHOUSE_DB=signal_horizon
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=clickhouse
```

When `CLICKHOUSE_ENABLED=false` (default), only real-time PostgreSQL queries are available.

## API Endpoints

### Check Status

```http
GET /api/v1/hunt/status
```

Returns hunt service capabilities.

**Response:**
```json
{
  "historical": true,
  "realtime": true
}
```

### Query Timeline

```http
POST /api/v1/hunt/query
Content-Type: application/json
```

Search for signals across the timeline.

**Request Body:**
```json
{
  "startTime": "2024-06-01T00:00:00Z",
  "endTime": "2024-06-15T12:00:00Z",
  "tenantId": "tenant-123",
  "signalTypes": ["IP_THREAT", "BOT_SIGNATURE"],
  "sourceIps": ["192.168.1.100", "10.0.0.1"],
  "severities": ["HIGH", "CRITICAL"],
  "minConfidence": 0.8,
  "anonFingerprint": "64-char-hash...",
  "limit": 100,
  "offset": 0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| startTime | ISO8601 | Yes | Query start time |
| endTime | ISO8601 | Yes | Query end time |
| tenantId | string | No | Filter by tenant |
| signalTypes | string[] | No | Filter by signal type |
| sourceIps | string[] | No | Filter by source IP |
| severities | string[] | No | Filter by severity |
| minConfidence | number | No | Minimum confidence (0-1) |
| anonFingerprint | string | No | Filter by fingerprint hash |
| limit | number | No | Max results (default: 1000) |
| offset | number | No | Pagination offset |

**Signal Types:**
- `IP_THREAT` - Malicious IP detection
- `FINGERPRINT_THREAT` - Browser fingerprint threat
- `CAMPAIGN_INDICATOR` - Campaign correlation indicator
- `CREDENTIAL_STUFFING` - Credential stuffing attack
- `RATE_ANOMALY` - Rate-based anomaly
- `BOT_SIGNATURE` - Bot detection signature

**Severities:**
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

**Response:**
```json
{
  "signals": [
    {
      "id": "signal-uuid",
      "timestamp": "2024-06-15T10:30:00Z",
      "tenantId": "tenant-123",
      "sensorId": "sensor-456",
      "signalType": "IP_THREAT",
      "sourceIp": "192.168.1.100",
      "anonFingerprint": "64-char-hash...",
      "severity": "HIGH",
      "confidence": 0.92,
      "eventCount": 15
    }
  ],
  "total": 1250,
  "source": "hybrid",
  "queryTimeMs": 145
}
```

| Field | Description |
|-------|-------------|
| signals | Array of matching signals |
| total | Total count (before limit) |
| source | Data source: `postgres`, `clickhouse`, or `hybrid` |
| queryTimeMs | Query execution time in milliseconds |

### Campaign Timeline

```http
GET /api/v1/hunt/timeline/:campaignId?startTime=...&endTime=...
```

Get historical timeline of campaign state changes.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| startTime | ISO8601 | Optional start filter |
| endTime | ISO8601 | Optional end filter |

**Response:**
```json
{
  "timeline": [
    {
      "timestamp": "2024-06-10T08:00:00Z",
      "campaignId": "campaign-123",
      "eventType": "created",
      "name": "Brute Force Campaign",
      "status": "ACTIVE",
      "severity": "HIGH",
      "isCrossTenant": true,
      "tenantsAffected": 3,
      "confidence": 0.85
    },
    {
      "timestamp": "2024-06-12T14:00:00Z",
      "campaignId": "campaign-123",
      "eventType": "escalated",
      "name": "Brute Force Campaign",
      "status": "ACTIVE",
      "severity": "CRITICAL",
      "isCrossTenant": true,
      "tenantsAffected": 8,
      "confidence": 0.95
    }
  ]
}
```

**Event Types:**
- `created` - Campaign first detected
- `updated` - Campaign parameters changed
- `escalated` - Severity increased
- `resolved` - Campaign marked resolved

### Hourly Statistics

```http
GET /api/v1/hunt/stats/hourly?tenantId=...&startTime=...&endTime=...&signalTypes=...
```

Get hourly aggregated statistics from the materialized view.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| tenantId | string | Optional tenant filter |
| startTime | ISO8601 | Start time (default: 7 days ago) |
| endTime | ISO8601 | End time (default: now) |
| signalTypes | string | Comma-separated signal types |

**Response:**
```json
{
  "stats": [
    {
      "hour": "2024-06-15T10:00:00Z",
      "tenantId": "tenant-123",
      "signalType": "IP_THREAT",
      "severity": "HIGH",
      "signalCount": 50,
      "totalEvents": 200,
      "uniqueIps": 15,
      "uniqueFingerprints": 8
    }
  ]
}
```

### IP Activity

```http
POST /api/v1/hunt/ip-activity
Content-Type: application/json
```

Investigate an IP address across all tenants.

**Request Body:**
```json
{
  "sourceIp": "192.168.1.100",
  "days": 90
}
```

**Response:**
```json
{
  "totalHits": 1500,
  "tenantsHit": 12,
  "firstSeen": "2024-03-15T08:00:00Z",
  "lastSeen": "2024-06-15T11:30:00Z",
  "signalTypes": ["IP_THREAT", "RATE_ANOMALY", "BOT_SIGNATURE"]
}
```

## Saved Queries

### Save a Query

```http
POST /api/v1/hunt/saved-queries
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Critical IP Threats",
  "description": "High-confidence IP threats across all tenants",
  "query": {
    "startTime": "2024-06-01T00:00:00Z",
    "endTime": "2024-06-15T12:00:00Z",
    "signalTypes": ["IP_THREAT"],
    "severities": ["CRITICAL"],
    "minConfidence": 0.9
  }
}
```

**Response:**
```json
{
  "id": "query-uuid",
  "name": "Critical IP Threats",
  "description": "High-confidence IP threats across all tenants",
  "query": { ... },
  "createdBy": "user-123",
  "createdAt": "2024-06-15T12:00:00Z"
}
```

### List Saved Queries

```http
GET /api/v1/hunt/saved-queries
```

**Response:**
```json
{
  "queries": [
    {
      "id": "query-uuid",
      "name": "Critical IP Threats",
      "description": "...",
      "query": { ... },
      "createdBy": "user-123",
      "createdAt": "2024-06-15T12:00:00Z",
      "lastRunAt": "2024-06-15T14:30:00Z"
    }
  ]
}
```

### Run a Saved Query

```http
POST /api/v1/hunt/saved-queries/:id/run
```

Executes the saved query and updates `lastRunAt`.

**Response:** Same as Query Timeline endpoint.

### Delete a Saved Query

```http
DELETE /api/v1/hunt/saved-queries/:id
```

**Response:**
```json
{
  "success": true
}
```

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_REQUEST | Invalid request parameters |
| 404 | NOT_FOUND | Resource not found |
| 500 | INTERNAL_ERROR | Server error |
| 503 | CLICKHOUSE_UNAVAILABLE | ClickHouse connection failed |

## Best Practices

### Query Optimization

1. **Use time filters**: Always specify `startTime` and `endTime` to leverage partition pruning
2. **Filter by tenant**: Add `tenantId` when investigating specific tenants
3. **Limit results**: Use `limit` for large result sets to improve response times
4. **Use saved queries**: Save frequently-used queries to avoid rebuilding filters

### Time Range Selection

- **Investigation (< 24h)**: Real-time PostgreSQL provides immediate results
- **Analysis (1-7 days)**: Hybrid queries balance freshness and depth
- **Forensics (30-90 days)**: ClickHouse provides efficient historical scans

### Monitoring Performance

The `queryTimeMs` field in responses indicates execution time:
- **< 100ms**: Excellent
- **100-500ms**: Good
- **500-2000ms**: Acceptable for large time ranges
- **> 2000ms**: Consider narrowing filters

## Schema Reference

### signal_events Table (ClickHouse)

```sql
CREATE TABLE signal_events (
    timestamp DateTime64(3),
    tenant_id LowCardinality(String),
    sensor_id LowCardinality(String),
    signal_type LowCardinality(String),
    source_ip IPv4,
    fingerprint String,
    anon_fingerprint FixedString(64),
    severity LowCardinality(String),
    confidence Float32,
    event_count UInt32,
    metadata String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, signal_type, timestamp)
TTL timestamp + INTERVAL 90 DAY;
```

### Materialized Views

- **signal_hourly_mv**: Hourly aggregations by tenant, signal type, severity
- **ip_daily_mv**: Daily IP activity aggregations

## React UI Components

The Hunt UI is available at `/hunting` in the Signal Horizon dashboard:

- **HuntQueryBuilder**: Time range, signal type, severity, and filter controls
- **HuntResultsTable**: Results with CSV export capability
- **SavedQueries**: Saved query management and execution

## Related Documentation

- [Signal Horizon Architecture](./architecture.md)
- [ClickHouse Schema](../clickhouse/schema.sql)
- [API Authentication](./authentication.md)
