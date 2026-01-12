# Signal Horizon Deployment Guide

This guide covers deploying Signal Horizon, the central command plane for Atlas Crew sensor fleets.

## Architecture Overview

Signal Horizon consists of three main components:

| Component | Purpose | Port |
|-----------|---------|------|
| API Server | REST API and WebSocket gateway | 3003 |
| PostgreSQL | Real-time data, configuration state | 5432 |
| ClickHouse | Historical data, time-series analytics | 8123/9000 |

```
                    ┌─────────────────────────────────────┐
                    │           Load Balancer             │
                    │         (HTTPS termination)         │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────┴───────────────────┐
                    │        Signal Horizon API           │
                    │   (Express + WebSocket Gateway)     │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
    ┌─────────┴─────────┐   ┌─────────┴─────────┐   ┌─────────┴─────────┐
    │    PostgreSQL     │   │    ClickHouse     │   │       Redis       │
    │  (real-time data) │   │ (historical data) │   │  (session cache)  │
    └───────────────────┘   └───────────────────┘   └───────────────────┘
```

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- ClickHouse 23.8+ (optional, for historical queries)
- Redis 7+ (optional, for session caching)
- Docker and Docker Compose (for containerized deployment)

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=3003
API_BASE_URL=https://signal-horizon.example.com

# PostgreSQL (Required)
DATABASE_URL=postgresql://user:password@localhost:5432/signal_horizon

# ClickHouse (Optional - enables historical queries)
CLICKHOUSE_ENABLED=true
CLICKHOUSE_HOST=clickhouse
CLICKHOUSE_HTTP_PORT=8123
CLICKHOUSE_NATIVE_PORT=9000
CLICKHOUSE_DB=signal_horizon
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-secure-password

# Redis (Optional - enables session caching)
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-jwt-secret-min-32-chars
API_KEY_SALT=your-api-key-salt

# Fleet Management
HEARTBEAT_INTERVAL_MS=60000
STALE_SENSOR_THRESHOLD_MS=90000
MAX_SENSORS=1000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
```

## Database Setup

### PostgreSQL Schema

Run the Prisma migrations to set up the PostgreSQL schema:

```bash
cd apps/signal-horizon/api
pnpm prisma migrate deploy
```

The schema includes:
- `Sensor` - Registered sensors and their status
- `ConfigTemplate` - Configuration templates
- `ConfigSyncState` - Per-sensor config sync tracking
- `Command` - Command queue for sensors
- `SavedQuery` - Saved hunt queries

### ClickHouse Schema

If using ClickHouse for historical data, apply the schema:

```bash
clickhouse-client --host localhost --query "$(cat apps/signal-horizon/clickhouse/schema.sql)"
```

Key tables:
- `signal_events` - Time-series signal data
- `campaign_timeline` - Campaign state history
- `signal_hourly_mv` - Hourly aggregations (materialized view)

## Deployment Options

### Option 1: Docker Compose (Recommended)

Use the provided compose file for a complete stack:

```yaml
# compose.yml
version: '3.8'

services:
  signal-horizon:
    image: atlascrew/signal-horizon:latest
    ports:
      - "3003:3003"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/signal_horizon
      - CLICKHOUSE_ENABLED=true
      - CLICKHOUSE_HOST=clickhouse
    depends_on:
      - postgres
      - clickhouse
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: signal_horizon
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    environment:
      CLICKHOUSE_DB: signal_horizon
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:
  clickhouse_data:
```

Deploy with:

```bash
docker compose up -d
```

### Option 2: Kubernetes

Apply the Kubernetes manifests:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/clickhouse.yaml
kubectl apply -f k8s/signal-horizon.yaml
kubectl apply -f k8s/ingress.yaml
```

Key considerations:
- Use `PersistentVolumeClaims` for database storage
- Configure `HorizontalPodAutoscaler` for API pods
- Use `NetworkPolicy` to restrict database access

### Option 3: Native Installation

For bare-metal or VM deployment:

```bash
# Install dependencies
cd apps/signal-horizon/api
pnpm install --prod

# Run migrations
pnpm prisma migrate deploy

# Start server
NODE_ENV=production node dist/server.js
```

Use a process manager like PM2:

```bash
pm2 start dist/server.js --name signal-horizon -i max
```

## Load Balancer Configuration

### Synapse-Pingora Example

```yaml
# /etc/synapse-pingora/config.yaml
server:
  listen: "0.0.0.0:443"

upstreams:
  - host: "127.0.0.1"
    port: 3003

logging:
  level: "info"
  access_log: true

tls:
  enabled: true
  cert_path: "/etc/ssl/certs/signal-horizon.crt"
  key_path: "/etc/ssl/private/signal-horizon.key"
```

Ensure your edge proxy supports WebSocket upgrades for `/ws`.

### AWS ALB

For AWS Application Load Balancer:

1. Create target group with health check path `/api/health`
2. Enable sticky sessions for WebSocket connections
3. Configure idle timeout to 300 seconds (for long-lived WS connections)
4. Use ACM certificate for HTTPS

## Sensor Registration

### Generate Sensor Credentials

```bash
# Create sensor via API
curl -X POST https://signal-horizon.example.com/api/fleet/sensors \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "US East Primary",
    "region": "us-east-1",
    "capabilities": ["waf", "bot-detection"]
  }'
```

Response includes the sensor ID and authentication token:

```json
{
  "id": "sensor-abc123",
  "token": "sensor-token-xyz789",
  "wsEndpoint": "wss://signal-horizon.example.com/ws/sensor"
}
```

### Sensor Configuration

Configure the Atlas Crew sensor to connect to Signal Horizon:

```yaml
# sensor.yaml
signal_horizon:
  enabled: true
  endpoint: wss://signal-horizon.example.com/ws/sensor
  sensor_id: sensor-abc123
  token: sensor-token-xyz789
  heartbeat_interval: 60s
  reconnect_delay: 5s
  max_reconnect_delay: 60s
```

## High Availability

### PostgreSQL HA

Use PostgreSQL replication for high availability:

```yaml
# Primary
postgresql:
  primary:
    enabled: true
  replica:
    enabled: true
    replicas: 2
```

### ClickHouse Cluster

For large-scale deployments, use ClickHouse cluster:

```xml
<clickhouse>
  <remote_servers>
    <signal_horizon_cluster>
      <shard>
        <replica>
          <host>clickhouse-1</host>
          <port>9000</port>
        </replica>
        <replica>
          <host>clickhouse-2</host>
          <port>9000</port>
        </replica>
      </shard>
    </signal_horizon_cluster>
  </remote_servers>
</clickhouse>
```

### API Server Scaling

Scale API servers horizontally:

```bash
# Docker Compose
docker compose up -d --scale signal-horizon=3

# Kubernetes
kubectl scale deployment signal-horizon --replicas=3
```

Considerations:
- Use Redis for shared session state
- WebSocket connections are per-server (use sticky sessions or Redis pub/sub)
- Command queue uses PostgreSQL for consistency

## Monitoring

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Basic health check |
| `GET /api/health/ready` | Readiness probe (DB connections) |
| `GET /api/health/live` | Liveness probe |

### Prometheus Metrics

Enable metrics endpoint:

```bash
METRICS_ENABLED=true
METRICS_PORT=9090
```

Key metrics:
- `signal_horizon_sensors_total` - Total connected sensors
- `signal_horizon_commands_queued` - Pending commands
- `signal_horizon_ws_connections` - Active WebSocket connections
- `signal_horizon_query_duration_seconds` - Query latencies

### Grafana Dashboards

Import the provided dashboards:

```bash
# Fleet Overview
grafana-cli dashboards install signal-horizon-fleet

# Query Performance
grafana-cli dashboards install signal-horizon-queries
```

## Backup and Recovery

### PostgreSQL Backup

```bash
# Daily backup
pg_dump -h localhost -U postgres signal_horizon | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup-20241222.sql.gz | psql -h localhost -U postgres signal_horizon
```

### ClickHouse Backup

```bash
# Backup tables
clickhouse-backup create signal_horizon_$(date +%Y%m%d)

# Restore
clickhouse-backup restore signal_horizon_20241222
```

## Security Hardening

### Network Security

1. **Firewall rules**: Only allow necessary ports
   - 443: HTTPS/WSS (public)
   - 5432: PostgreSQL (internal only)
   - 8123/9000: ClickHouse (internal only)
   - 6379: Redis (internal only)

2. **TLS configuration**: Use TLS 1.3, disable older versions

3. **API authentication**: Require JWT or API key for all endpoints

### Secrets Management

Use a secrets manager (Vault, AWS Secrets Manager, etc.):

```bash
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id signal-horizon/prod | jq -r '.SecretString' > .env
```

### Audit Logging

Enable audit logging for compliance:

```bash
AUDIT_LOG_ENABLED=true
AUDIT_LOG_DESTINATION=cloudwatch  # or file, syslog
```

## Troubleshooting

### Sensor Connection Issues

```bash
# Check WebSocket connections
curl -s localhost:3003/api/fleet/metrics | jq '.totalSensors'

# View sensor logs
docker compose logs signal-horizon | grep "sensor connection"
```

### Database Connection Pool

If seeing connection errors:

```bash
# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'signal_horizon'"

# Increase pool size
DATABASE_POOL_SIZE=50
```

### ClickHouse Query Performance

```sql
-- Check slow queries
SELECT query, query_duration_ms
FROM system.query_log
WHERE type = 'QueryFinish'
  AND query_duration_ms > 1000
ORDER BY query_duration_ms DESC
LIMIT 10;
```

## Upgrade Procedure

### Rolling Upgrade

1. Build new image:
   ```bash
   docker build -t atlascrew/signal-horizon:2.5.0 .
   ```

2. Run migrations:
   ```bash
   docker run --rm atlascrew/signal-horizon:2.5.0 pnpm prisma migrate deploy
   ```

3. Rolling restart:
   ```bash
   kubectl rollout restart deployment signal-horizon
   ```

4. Verify health:
   ```bash
   kubectl rollout status deployment signal-horizon
   ```

### Rollback

```bash
# Kubernetes
kubectl rollout undo deployment signal-horizon

# Docker Compose
docker compose pull  # pulls previous image
docker compose up -d
```

## Related Documentation

- [Fleet API](./fleet-api.md) - Fleet management API reference
- [Hunt API](./hunt-api.md) - Threat hunting queries
- [ClickHouse Schema](../clickhouse/schema.sql) - Historical data schema
