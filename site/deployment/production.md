---
title: Production Checklist
---

# Production Checklist

Review this checklist before deploying Horizon and Synapse to production.

## Security

- [ ] **TLS enabled** — TLS 1.2+ on all public endpoints, TLS 1.3 preferred
- [ ] **JWT secrets** — strong, unique secrets for `JWT_SECRET` and `TELEMETRY_JWT_SECRET` (32+ chars)
- [ ] **Config encryption** — `CONFIG_ENCRYPTION_KEY` set for encrypting sensitive config fields at rest
- [ ] **API keys rotated** — default/demo keys replaced with strong random values
- [ ] **Synapse admin key** — `admin_api_key` set in config (random key auto-generated if unset)
- [ ] **CORS restricted** — `CORS_ORIGINS` limited to known dashboard URLs
- [ ] **Network isolation** — database ports (5432, 8123, 6379) not exposed to the internet
- [ ] **Firewall rules** — only ports 443 (HTTPS/WSS) and admin ports on internal network

## Reliability

- [ ] **PostgreSQL HA** — streaming replication with at least one read replica
- [ ] **Redis** — deployed for session sharing across multiple Horizon instances
- [ ] **Health probes** — readiness and liveness probes configured for all services
- [ ] **Graceful shutdown** — `shutdown_timeout_secs` configured in Synapse (default: 30s)
- [ ] **Backpressure** — aggregator queue limits configured (`SIGNAL_BATCH_SIZE`, `SIGNAL_BATCH_TIMEOUT_MS`)
- [ ] **Connection limits** — `WS_MAX_SENSOR_CONNECTIONS` and `WS_MAX_DASHBOARD_CONNECTIONS` set appropriately

## Monitoring

- [ ] **Prometheus scraping** — metrics endpoints enabled for both Horizon and Synapse
- [ ] **Grafana dashboards** — fleet overview and query performance dashboards imported
- [ ] **Alerting** — alerts configured for sensor disconnects, high error rates, database connection failures
- [ ] **Log aggregation** — structured JSON logs shipped to a central logging platform
- [ ] **Synapse detection metrics** — monitor `X-Synapse-Detection-Time-Us` for latency regressions

## Backup

- [ ] **PostgreSQL** — daily `pg_dump` with retention policy
- [ ] **ClickHouse** — `clickhouse-backup` scheduled if ClickHouse is enabled
- [ ] **Restore tested** — backup restoration procedure verified on a non-production instance

::: danger Test your restores
A backup that has never been restored is not a backup. Verify the restore procedure on a staging environment before going to production.
:::

## Upgrades

### Rolling Upgrade Procedure

1. Build the new image
2. Run database migrations: `pnpm prisma migrate deploy`
3. Rolling restart: `kubectl rollout restart deployment horizon-api`
4. Verify health: `kubectl rollout status deployment horizon-api`

### Rollback

```sh
# Kubernetes
kubectl rollout undo deployment horizon-api

# Docker Compose
docker compose pull && docker compose up -d
```

## Scaling Considerations

| Component | Strategy |
| --- | --- |
| **Horizon API** | Horizontal — add replicas behind a load balancer with sticky sessions |
| **Synapse** | Horizontal — one instance per edge location or per upstream cluster |
| **PostgreSQL** | Vertical first, then read replicas for query load |
| **ClickHouse** | Shard by tenant or time range for high-volume deployments |
| **Redis** | Single instance for small fleets, Redis Cluster for 100+ sensors |
