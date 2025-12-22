# Fleet Management API Documentation

The Fleet Management API provides centralized control over distributed WAF sensor networks. It enables real-time monitoring, configuration deployment, rule distribution, and software updates across the sensor fleet.

## Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Signal Horizon Hub                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ FleetAggregator │ ConfigManager   │ RuleDistributor             │
│ (metrics)       │ (templates)     │ (WAF rules)                 │
├─────────────────┴─────────────────┴─────────────────────────────┤
│                    WebSocket Gateway                            │
│                    (sensor connections)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
    ┌─────────┐          ┌─────────┐          ┌─────────┐
    │ Sensor  │          │ Sensor  │          │ Sensor  │
    │  US-E   │          │  EU-W   │          │  APAC   │
    └─────────┘          └─────────┘          └─────────┘
```

### Performance Targets

| Metric | Target |
|--------|--------|
| Sensor capacity | 1,000+ concurrent connections |
| Heartbeat interval | 60 seconds |
| Stale detection | 90 seconds |
| Config push latency | < 5 seconds |
| Metrics aggregation | Real-time (5s window) |

## Fleet Overview

### Get Fleet Metrics

```http
GET /api/fleet/metrics
```

Returns aggregated metrics across all sensors.

**Response:**
```json
{
  "totalSensors": 24,
  "onlineCount": 22,
  "warningCount": 1,
  "offlineCount": 1,
  "totalRps": 45000,
  "avgLatencyMs": 12.5,
  "timestamp": "2024-12-22T10:30:00Z"
}
```

| Field | Description |
|-------|-------------|
| totalSensors | Total registered sensors |
| onlineCount | Sensors with healthy status |
| warningCount | Sensors with degraded performance |
| offlineCount | Sensors not responding |
| totalRps | Aggregate requests per second |
| avgLatencyMs | Fleet-wide average latency |

### List Sensors

```http
GET /api/fleet/sensors
```

Returns all registered sensors with current status.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status: `online`, `warning`, `offline` |
| region | string | Filter by region code |
| limit | number | Max results (default: 100) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "sensors": [
    {
      "id": "sensor-us-east-1",
      "name": "US East Primary",
      "status": "online",
      "cpu": 45.2,
      "memory": 62.8,
      "rps": 12500,
      "latencyMs": 8.3,
      "version": "2.4.1",
      "region": "us-east-1",
      "lastHeartbeat": "2024-12-22T10:29:55Z"
    }
  ],
  "total": 24
}
```

### Get Sensor Details

```http
GET /api/fleet/sensors/:sensorId
```

Returns detailed information for a specific sensor.

**Response:**
```json
{
  "id": "sensor-us-east-1",
  "name": "US East Primary",
  "status": "online",
  "cpu": 45.2,
  "memory": 62.8,
  "disk": 35.0,
  "rps": 12500,
  "latencyMs": 8.3,
  "version": "2.4.1",
  "region": "us-east-1",
  "capabilities": ["waf", "bot-detection", "rate-limiting"],
  "configHash": "a1b2c3d4...",
  "rulesHash": "e5f6g7h8...",
  "lastHeartbeat": "2024-12-22T10:29:55Z",
  "registeredAt": "2024-01-15T08:00:00Z"
}
```

## Fleet Health

### Get Health Summary

```http
GET /api/fleet/health
```

Returns overall fleet health status with alerts.

**Response:**
```json
{
  "overallScore": 92,
  "criticalAlerts": 1,
  "warningAlerts": 3,
  "recentIncidents": [
    {
      "id": "incident-123",
      "sensorId": "sensor-eu-west-2",
      "type": "high_cpu",
      "message": "CPU usage exceeded 90%",
      "timestamp": "2024-12-22T10:25:00Z"
    }
  ]
}
```

| Health Score | Status |
|--------------|--------|
| 90-100 | Healthy (green) |
| 70-89 | Warning (yellow) |
| 0-69 | Critical (red) |

## Configuration Management

### List Config Templates

```http
GET /api/fleet/config/templates
```

Returns all configuration templates.

**Response:**
```json
{
  "templates": [
    {
      "id": "template-prod-default",
      "name": "Production Default",
      "description": "Standard production configuration",
      "environment": "production",
      "version": "1.2.0",
      "isActive": true,
      "createdAt": "2024-06-01T00:00:00Z",
      "updatedAt": "2024-12-20T14:30:00Z"
    }
  ]
}
```

### Create Config Template

```http
POST /api/fleet/config/templates
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "High Security Config",
  "description": "Enhanced security settings for sensitive regions",
  "environment": "production",
  "config": {
    "rateLimiting": {
      "enabled": true,
      "requestsPerSecond": 100,
      "burstSize": 200
    },
    "waf": {
      "mode": "blocking",
      "sensitivity": "high"
    },
    "logging": {
      "level": "debug",
      "includeHeaders": true
    }
  }
}
```

**Response:**
```json
{
  "id": "template-new-123",
  "name": "High Security Config",
  "version": "1.0.0",
  "createdAt": "2024-12-22T10:30:00Z"
}
```

### Get Sync Status

```http
GET /api/fleet/config/sync-status
```

Returns configuration sync status across the fleet.

**Response:**
```json
{
  "totalSensors": 24,
  "syncedSensors": 22,
  "outOfSyncSensors": 1,
  "errorSensors": 1,
  "syncPercentage": 91.7
}
```

### Push Configuration

```http
POST /api/fleet/config/push
Content-Type: application/json
```

Deploy a configuration template to sensors.

**Request Body:**
```json
{
  "templateId": "template-prod-default",
  "sensorIds": ["sensor-us-east-1", "sensor-us-west-2"],
  "force": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| templateId | string | Yes | Configuration template ID |
| sensorIds | string[] | No | Target sensors (empty = all) |
| force | boolean | No | Override pending changes |

**Response:**
```json
{
  "success": true,
  "targeted": 2,
  "queued": 2,
  "commandIds": ["cmd-123", "cmd-456"]
}
```

## Rule Distribution

### List Rules

```http
GET /api/fleet/rules
```

Returns all WAF rules available for distribution.

**Response:**
```json
{
  "rules": [
    {
      "id": "rule-sql-injection",
      "name": "SQL Injection Detection",
      "description": "Detects common SQL injection patterns",
      "severity": "critical",
      "enabled": true,
      "category": "injection",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Get Rule Sync Status

```http
GET /api/fleet/rules/sync-status
```

Returns rule synchronization status per sensor.

**Response:**
```json
{
  "syncStatus": [
    {
      "sensorId": "sensor-us-east-1",
      "totalRules": 125,
      "syncedRules": 125,
      "pendingRules": 0,
      "failedRules": 0,
      "lastSync": "2024-12-22T10:00:00Z"
    }
  ]
}
```

### Push Rules

```http
POST /api/fleet/rules/push
Content-Type: application/json
```

Deploy rules to sensors with rollout strategy.

**Request Body:**
```json
{
  "ruleIds": ["rule-sql-injection", "rule-xss-detection"],
  "sensorIds": ["sensor-us-east-1"],
  "strategy": "canary"
}
```

**Rollout Strategies:**

| Strategy | Description |
|----------|-------------|
| `immediate` | Deploy to all targets at once |
| `canary` | 10% → 50% → 100% progressive rollout |
| `scheduled` | Deploy at specified time |

**Response:**
```json
{
  "success": true,
  "rolloutId": "rollout-789",
  "strategy": "canary",
  "phases": [
    { "phase": 1, "percentage": 10, "sensors": 1 },
    { "phase": 2, "percentage": 50, "sensors": 5 },
    { "phase": 3, "percentage": 100, "sensors": 10 }
  ]
}
```

## Fleet Updates

### Get Available Updates

```http
GET /api/fleet/updates/available
```

Returns available software updates.

**Response:**
```json
{
  "updates": [
    {
      "version": "2.5.0",
      "releaseDate": "2024-12-20T00:00:00Z",
      "changelog": [
        "Improved bot detection accuracy",
        "Added JA4 fingerprint support",
        "Performance optimizations"
      ],
      "critical": false
    }
  ]
}
```

### Get Version Status

```http
GET /api/fleet/updates/versions
```

Returns current version status per sensor.

**Response:**
```json
{
  "versions": [
    {
      "sensorId": "sensor-us-east-1",
      "name": "US East Primary",
      "currentVersion": "2.4.1",
      "targetVersion": "2.5.0",
      "updateStatus": "update_available",
      "lastUpdated": "2024-12-01T00:00:00Z"
    }
  ]
}
```

**Update Status Values:**

| Status | Description |
|--------|-------------|
| `up_to_date` | Running latest version |
| `update_available` | New version available |
| `updating` | Update in progress |
| `failed` | Update failed |

### Trigger Update

```http
POST /api/fleet/updates/trigger
Content-Type: application/json
```

Initiate software update on sensors.

**Request Body:**
```json
{
  "sensorIds": ["sensor-us-east-1", "sensor-us-west-2"],
  "version": "2.5.0"
}
```

**Response:**
```json
{
  "success": true,
  "triggered": 2,
  "commandIds": ["cmd-update-123", "cmd-update-456"]
}
```

## WebSocket Protocol

Sensors connect via WebSocket for real-time communication.

### Connection

```
wss://signal-horizon.example.com/ws/sensor?sensorId=xxx&token=yyy
```

### Heartbeat Message

Sensors send heartbeats every 60 seconds:

```json
{
  "type": "heartbeat",
  "sensorId": "sensor-us-east-1",
  "timestamp": "2024-12-22T10:30:00Z",
  "status": "healthy",
  "cpu": 45.2,
  "memory": 62.8,
  "disk": 35.0,
  "requestsLastMinute": 750000,
  "avgLatencyMs": 8.3,
  "configHash": "a1b2c3d4...",
  "rulesHash": "e5f6g7h8..."
}
```

### Command Messages

Hub sends commands to sensors:

```json
{
  "type": "command",
  "commandId": "cmd-123",
  "command": {
    "type": "push_config",
    "config": { ... }
  }
}
```

**Command Types:**

| Type | Description |
|------|-------------|
| `push_config` | Deploy configuration |
| `push_rules` | Deploy WAF rules |
| `update` | Trigger software update |
| `restart` | Restart sensor services |

### Acknowledgment

Sensors acknowledge commands:

```json
{
  "type": "ack",
  "commandId": "cmd-123",
  "success": true,
  "message": "Configuration applied"
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
| 400 | INVALID_REQUEST | Invalid parameters |
| 404 | SENSOR_NOT_FOUND | Sensor ID not found |
| 409 | COMMAND_PENDING | Conflicting command in progress |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SENSOR_OFFLINE | Target sensor not connected |

## Best Practices

### Configuration Management

1. **Test in staging**: Always deploy to staging environment first
2. **Use canary rollouts**: Gradual rollout catches issues early
3. **Monitor after push**: Watch health metrics for 15 minutes post-deployment
4. **Version templates**: Increment version on each change

### Rule Distribution

1. **Group by severity**: Deploy critical rules fleet-wide, experimental rules to canary
2. **Validate rules**: Test rules in staging before production push
3. **Monitor false positives**: Check WAF logs after rule deployment
4. **Rollback ready**: Keep previous rule set available for quick rollback

### Fleet Updates

1. **Staggered updates**: Never update entire fleet simultaneously
2. **Business hours**: Schedule updates during low-traffic periods
3. **Rollback plan**: Ensure previous version is available
4. **Health checks**: Verify sensor health after each update phase

## Related Documentation

- [Hunt API](./hunt-api.md) - Threat hunting queries
- [Sensor Protocol](./sensor-protocol.md) - WebSocket protocol details
- [Deployment Guide](./deployment.md) - Signal Horizon deployment
