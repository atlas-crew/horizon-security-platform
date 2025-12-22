# Fleet Management Services

Backend services for Signal Horizon fleet management, sensor orchestration, and configuration synchronization.

## Overview

The Fleet Management services provide the backend infrastructure for managing a distributed fleet of Synapse sensors. These services handle real-time metrics aggregation, configuration management, command orchestration, and rule deployment across the fleet.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Fleet Management Layer                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Fleet     │  │    Config    │  │    Fleet     │       │
│  │  Aggregator  │  │   Manager    │  │  Commander   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                  │                  │              │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                  ┌─────────┴─────────┐                       │
│                  │  Rule Distributor │                       │
│                  └───────────────────┘                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
            Sensor Fleet          Dashboard UI
```

## Services

### 1. FleetAggregator

**Purpose**: Real-time aggregation of sensor heartbeats into fleet-wide metrics.

**Key Features**:
- Aggregates metrics from all sensors (RPS, latency, resource usage)
- Computes fleet-wide health score
- Detects sensors requiring attention (degraded health, high resource usage)
- Tracks online/offline status
- Regional metrics aggregation

**Events**:
- `metrics-updated`: Emitted when fleet metrics change
- `sensor-online`: Sensor comes online
- `sensor-offline`: Sensor goes offline
- `sensor-alert`: Sensor requires attention

**Usage**:
```typescript
import { FleetAggregator } from './services/fleet';

const aggregator = new FleetAggregator(logger, {
  heartbeatTimeoutMs: 60000, // 60 seconds
  cpuAlertThreshold: 80,
  memoryAlertThreshold: 85,
  diskAlertThreshold: 90,
});

// Update from heartbeat
aggregator.updateSensorMetrics(sensorId, heartbeat);

// Get fleet-wide metrics
const metrics = aggregator.getFleetMetrics();

// Get sensors requiring attention
const alerts = aggregator.getSensorsRequiringAttention();
```

### 2. ConfigManager

**Purpose**: Manage configuration templates and track sync state across the fleet.

**Key Features**:
- CRUD operations for configuration templates
- Track config/rules/blocklist sync state per sensor
- Generate config diffs
- Push configurations to sensors
- Fleet-wide sync status monitoring

**Usage**:
```typescript
import { ConfigManager } from './services/fleet';

const configManager = new ConfigManager(prisma, logger);
configManager.setFleetCommander(fleetCommander);

// Create config template
const template = await configManager.createTemplate({
  name: 'Production Config v2',
  environment: 'production',
  config: { /* config object */ },
  hash: await configManager.computeConfigHash(config),
  version: '2.0.0',
  isActive: true,
});

// Push config to sensors
const result = await configManager.pushConfig(sensorIds, template.id);

// Check sync status
const syncStatus = await configManager.getFleetSyncStatus();
```

### 3. FleetCommander

**Purpose**: Send commands to sensors and track their execution status.

**Key Features**:
- Send commands to single or multiple sensors
- Broadcast commands to entire fleet
- Track command status (pending, sent, success, failed, timeout)
- Automatic timeout detection and retry logic
- Command history tracking

**Events**:
- `command-sent`: Command sent to sensor
- `command-success`: Command completed successfully
- `command-failed`: Command failed
- `command-timeout`: Command timed out

**Usage**:
```typescript
import { FleetCommander } from './services/fleet';

const commander = new FleetCommander(prisma, logger, {
  defaultTimeoutMs: 30000,
  maxRetries: 3,
});

// Send command to sensor
const commandId = await commander.sendCommand(sensorId, {
  type: 'push_config',
  payload: { config: {...} },
  timeout: 60000,
});

// Check command status
const status = await commander.getCommandStatus(commandId);

// Broadcast to all sensors
const commandIds = await commander.broadcastCommand({
  type: 'sync_blocklist',
  payload: {},
});
```

### 4. RuleDistributor

**Purpose**: Manage rule deployment and synchronization across the sensor fleet.

**Key Features**:
- Push rules to sensors with rollout strategies
- Track rule sync status per sensor
- Support for immediate, canary, and scheduled deployments
- Retry failed rule syncs
- Bulk rule updates

**Rollout Strategies**:
- **Immediate**: Push to all sensors at once
- **Canary**: Roll out in stages (10% → 50% → 100%)
- **Scheduled**: Push at a specific time

**Usage**:
```typescript
import { RuleDistributor } from './services/fleet';

const distributor = new RuleDistributor(prisma, logger);
distributor.setFleetCommander(fleetCommander);

// Immediate deployment
const result = await distributor.pushRules(sensorIds, rules);

// Canary deployment
const canaryResult = await distributor.pushRulesWithStrategy(sensorIds, rules, {
  strategy: 'canary',
  canaryPercentages: [10, 50, 100],
  delayBetweenStages: 60000, // 1 minute
});

// Check rule sync status
const syncStatus = await distributor.getRuleSyncStatus();
const sensorStatus = await distributor.getSensorRuleStatus(sensorId);

// Retry failed rules
await distributor.retryFailedRules(sensorId);
```

## Database Schema

The fleet management services use the following Prisma models:

### ConfigTemplate
Stores configuration templates for deployment to sensors.

```prisma
model ConfigTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  environment String   @default("production")
  config      Json
  hash        String   // SHA-256 of config
  version     String   @default("1.0.0")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### SensorSyncState
Tracks configuration synchronization state for each sensor.

```prisma
model SensorSyncState {
  id                    String   @id @default(cuid())
  sensorId              String   @unique
  expectedConfigHash    String
  expectedRulesHash     String
  expectedBlocklistHash String
  actualConfigHash      String?
  actualRulesHash       String?
  actualBlocklistHash   String?
  lastSyncAttempt       DateTime?
  lastSyncSuccess       DateTime?
  syncErrors            String[]
}
```

### FleetCommand
Tracks commands sent to sensors.

```prisma
model FleetCommand {
  id          String   @id @default(cuid())
  sensorId    String
  commandType String
  payload     Json
  status      String   @default("pending")
  result      Json?
  error       String?
  queuedAt    DateTime @default(now())
  sentAt      DateTime?
  completedAt DateTime?
  attempts    Int      @default(0)
  timeoutAt   DateTime
}
```

### RuleSyncState
Tracks rule synchronization state per sensor per rule.

```prisma
model RuleSyncState {
  id        String   @id @default(cuid())
  sensorId  String
  ruleId    String
  status    String   @default("pending")
  syncedAt  DateTime?
  error     String?
}
```

## Running Migrations

To apply the fleet management database schema:

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:pass@localhost:5432/signal_horizon"

# Run migration
pnpm prisma migrate dev --name add_fleet_management

# Or in production
pnpm prisma migrate deploy
```

## Integration Example

Complete example of initializing all fleet services:

```typescript
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import {
  FleetAggregator,
  ConfigManager,
  FleetCommander,
  RuleDistributor,
} from './services/fleet';

const prisma = new PrismaClient();
const logger = pino();

// Initialize services
const aggregator = new FleetAggregator(logger, {
  heartbeatTimeoutMs: 60000,
  cpuAlertThreshold: 80,
  memoryAlertThreshold: 85,
  diskAlertThreshold: 90,
});

const commander = new FleetCommander(prisma, logger, {
  defaultTimeoutMs: 30000,
  maxRetries: 3,
});

const configManager = new ConfigManager(prisma, logger);
configManager.setFleetCommander(commander);

const ruleDistributor = new RuleDistributor(prisma, logger);
ruleDistributor.setFleetCommander(commander);

// Listen to events
aggregator.on('sensor-alert', (alert) => {
  logger.warn({ alert }, 'Sensor alert');
  // Optionally send notification
});

commander.on('command-failed', ({ commandId, sensorId, error }) => {
  logger.error({ commandId, sensorId, error }, 'Command failed');
  // Optionally retry or escalate
});

// Handle sensor heartbeat
function handleSensorHeartbeat(heartbeat: SensorHeartbeat) {
  aggregator.updateSensorMetrics(heartbeat.sensorId, heartbeat);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  aggregator.stop();
  commander.stop();
  await prisma.$disconnect();
});
```

## API Endpoints (Example)

These services can be exposed via REST API endpoints:

```typescript
// GET /api/fleet/metrics
app.get('/api/fleet/metrics', (req, res) => {
  const metrics = aggregator.getFleetMetrics();
  res.json(metrics);
});

// GET /api/fleet/alerts
app.get('/api/fleet/alerts', (req, res) => {
  const alerts = aggregator.getSensorsRequiringAttention();
  res.json(alerts);
});

// GET /api/fleet/sync-status
app.get('/api/fleet/sync-status', async (req, res) => {
  const status = await configManager.getFleetSyncStatus();
  res.json(status);
});

// POST /api/fleet/config/push
app.post('/api/fleet/config/push', async (req, res) => {
  const { sensorIds, templateId } = req.body;
  const result = await configManager.pushConfig(sensorIds, templateId);
  res.json(result);
});

// POST /api/fleet/rules/push
app.post('/api/fleet/rules/push', async (req, res) => {
  const { sensorIds, rules, strategy } = req.body;
  const result = await ruleDistributor.pushRulesWithStrategy(
    sensorIds,
    rules,
    strategy
  );
  res.json(result);
});

// GET /api/fleet/commands/:commandId
app.get('/api/fleet/commands/:commandId', async (req, res) => {
  const status = await commander.getCommandStatus(req.params.commandId);
  res.json(status);
});
```

## Testing

Unit tests should cover:
- Metric aggregation logic
- Config hash computation
- Command timeout detection
- Rule rollout strategies
- Sync state tracking

Example test:
```typescript
import { describe, it, expect } from 'vitest';
import { FleetAggregator } from './fleet-aggregator';

describe('FleetAggregator', () => {
  it('should compute fleet metrics correctly', () => {
    const aggregator = new FleetAggregator(mockLogger);

    aggregator.updateSensorMetrics('sensor1', {
      sensorId: 'sensor1',
      tenantId: 'tenant1',
      timestamp: new Date(),
      metrics: { rps: 100, latency: 50, cpu: 60, memory: 70, disk: 80 },
      health: 'healthy',
      requestsTotal: 1000,
    });

    const metrics = aggregator.getFleetMetrics();

    expect(metrics.totalSensors).toBe(1);
    expect(metrics.onlineSensors).toBe(1);
    expect(metrics.totalRps).toBe(100);
    expect(metrics.avgLatency).toBe(50);
  });
});
```

## Performance Considerations

- **FleetAggregator**: Metrics stored in-memory for fast access. Stale metrics automatically cleaned up.
- **ConfigManager**: Config hashes computed once and cached. Use indexes for sync state queries.
- **FleetCommander**: Timeout checker runs every 5 seconds. Commands auto-expire after retention period.
- **RuleDistributor**: Canary deployments process sensors in batches to avoid overwhelming the system.

## Monitoring

Key metrics to monitor:
- Fleet health score trend
- Sensors out of sync percentage
- Command success/failure rate
- Average command completion time
- Number of sensors requiring attention

## Error Handling

All services use structured logging with contextual information:
- Service name
- Sensor IDs
- Tenant IDs
- Error messages
- Timestamps

Example log output:
```json
{
  "level": "error",
  "service": "fleet-commander",
  "commandId": "cmd_123",
  "sensorId": "sensor_456",
  "error": "Command timeout",
  "msg": "Command failed permanently"
}
```

## Security Considerations

- Config templates can contain sensitive data - ensure proper access control
- Commands should be validated before sending to sensors
- Rule deployment requires authorization
- Audit all configuration changes
- Rate limit command sending to prevent abuse

## Future Enhancements

- [ ] A/B testing support for configuration changes
- [ ] Automated rollback on failed deployments
- [ ] Sensor performance profiling
- [ ] Predictive alerting based on metric trends
- [ ] Configuration drift detection
- [ ] Multi-region coordination
