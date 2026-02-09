import type { Logger } from 'pino';
import type { SeedOptions } from './args.js';
import type { SeedSummary } from './seed-postgres.js';
import { Rng } from './rng.js';
import { iso, randomHex, randomIp, sha256Hex, clamp } from './util.js';
import { ClickHouseService, type SignalEventRow, type HttpTransactionRow, type LogEntryRow, type CampaignHistoryRow, type BlocklistHistoryRow } from '../../src/storage/clickhouse/client.js';
import { SignalType, Severity } from '@prisma/client';

function clickhouseTenantId(tenantId: string): string {
  // ClickHouse schema uses tenant_id string; we keep the same IDs.
  return tenantId;
}

export async function seedClickhouse(logger: Logger, opts: SeedOptions, summary: SeedSummary): Promise<void> {
  if (!opts.clickhouse) return;
  if (!process.env.CLICKHOUSE_ENABLED || !['true', '1', 'yes', 'y', 'on'].includes(process.env.CLICKHOUSE_ENABLED.toLowerCase())) {
    logger.info('Seed ClickHouse skipped (CLICKHOUSE_ENABLED not set true)');
    return;
  }

  const clickhouse = new ClickHouseService(
    {
      host: process.env.CLICKHOUSE_HOST ?? 'localhost',
      port: parseInt(process.env.CLICKHOUSE_HTTP_PORT ?? '8123', 10),
      database: process.env.CLICKHOUSE_DB ?? 'signal_horizon',
      username: process.env.CLICKHOUSE_USER ?? 'default',
      password: process.env.CLICKHOUSE_PASSWORD ?? 'clickhouse',
      compression: (process.env.CLICKHOUSE_COMPRESSION ?? 'true').toLowerCase() !== 'false',
      maxOpenConnections: parseInt(process.env.CLICKHOUSE_MAX_CONNECTIONS ?? '10', 10),
    },
    logger,
    true
  );

  const ok = await clickhouse.ping();
  if (!ok) {
    logger.warn('Seed ClickHouse skipped (ping failed)');
    await clickhouse.close();
    return;
  }

  const rng = new Rng(opts.seed ^ 0xdecafbad);
  const now = Date.now();
  const startMs = now - opts.clickhouseDays * 86_400_000;
  const types = [
    SignalType.IP_THREAT,
    SignalType.FINGERPRINT_THREAT,
    SignalType.CREDENTIAL_STUFFING,
    SignalType.RATE_ANOMALY,
    SignalType.BOT_SIGNATURE,
    SignalType.IMPOSSIBLE_TRAVEL,
    SignalType.SCHEMA_VIOLATION,
  ] as const;
  const severities = [Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL] as const;

  const signalRows: SignalEventRow[] = [];
  const httpRows: HttpTransactionRow[] = [];
  const logRows: LogEntryRow[] = [];
  const campaignRows: CampaignHistoryRow[] = [];
  const blocklistRows: BlocklistHistoryRow[] = [];

  for (const t of summary.tenants) {
    const tenant_id = clickhouseTenantId(t.tenantId);
    for (const sensor_id of t.sensors.slice(0, Math.min(10, t.sensors.length))) {
      for (let day = 0; day < opts.clickhouseDays; day++) {
        const dayBase = startMs + day * 86_400_000;
        const n = opts.clickhouseSignalsPerSensorPerDay;
        for (let i = 0; i < n; i++) {
          const ts = new Date(dayBase + rng.int(0, 86_399_000));
          const fp = `fp_${sha256Hex(`${tenant_id}:${sensor_id}:${day}:${i}`).slice(0, 16)}`;
          const anon_fp = sha256Hex(`anon:${tenant_id}:${fp}`);
          const requestId = rng.bool(0.6) ? `req_${randomHex(rng, 8)}` : null;
          const type = String(rng.pick(types));
          const severity = String(rng.pick(severities));
          const sourceIp = randomIp(rng);
          const confidence = clamp(0.5 + rng.float() * 0.5, 0, 1);

          signalRows.push({
            timestamp: iso(ts),
            tenant_id,
            sensor_id,
            request_id: requestId,
            signal_type: type,
            source_ip: sourceIp,
            fingerprint: fp,
            anon_fingerprint: anon_fp,
            severity,
            confidence,
            event_count: rng.int(1, 80),
            metadata: JSON.stringify({ path: '/api/v1/auth/login', method: 'POST', seeded: true }),
          });

          if (requestId) {
            httpRows.push({
              timestamp: iso(ts),
              tenant_id,
              sensor_id,
              request_id: requestId,
              site: 'seed-site',
              method: rng.pick(['GET', 'POST', 'PUT', 'DELETE']),
              path: rng.pick(['/api/v1/auth/login', '/api/v1/catalog', '/api/v1/users/profile']),
              status_code: rng.pick([200, 200, 200, 401, 403, 429, 500]),
              latency_ms: rng.int(5, 2200),
              waf_action: rng.bool(0.15) ? rng.pick(['block', 'challenge', 'log']) : null,
            });
            logRows.push({
              timestamp: iso(ts),
              tenant_id,
              sensor_id,
              request_id: requestId,
              log_id: `log_${randomHex(rng, 8)}`,
              source: rng.pick(['access', 'waf', 'syslog']),
              level: rng.pick(['info', 'warn', 'error']),
              message: 'Seeded log entry',
              fields: JSON.stringify({ seeded: true }),
              method: rng.pick(['GET', 'POST', 'PUT', 'DELETE']),
              path: rng.pick(['/api/v1/auth/login', '/api/v1/catalog']),
              status_code: rng.pick([200, 401, 403, 429, 500]),
              latency_ms: rng.int(5, 2200),
              client_ip: sourceIp,
              rule_id: rng.bool(0.1) ? 'rule-sqli-001' : null,
            });
          }
        }
      }
    }

    // Light campaign + blocklist history rows for tenant
    campaignRows.push({
      timestamp: iso(new Date(now - 2 * 86_400_000)),
      campaign_id: `cmp_${sha256Hex(`${tenant_id}:seed`).slice(0, 10)}`,
      tenant_id,
      request_id: null,
      event_type: 'created',
      name: 'Seed Campaign',
      status: 'ACTIVE',
      severity: 'HIGH',
      is_cross_tenant: 0,
      tenants_affected: 1,
      confidence: 0.8,
      metadata: JSON.stringify({ seeded: true }),
    });
    blocklistRows.push({
      timestamp: iso(new Date(now - 86_400_000)),
      tenant_id,
      request_id: null,
      action: 'added',
      block_type: 'IP',
      indicator: '203.0.113.10',
      source: 'EXTERNAL_FEED',
      reason: 'Seeded ClickHouse blocklist history',
      campaign_id: 'seed',
      expires_at: iso(new Date(now + 7 * 86_400_000)),
    });
  }

  // Chunk inserts to avoid oversized HTTP payloads
  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  for (const part of chunk(signalRows, 5000)) await clickhouse.insertSignalEvents(part);
  for (const part of chunk(httpRows, 5000)) await clickhouse.insertHttpTransactions(part);
  for (const part of chunk(logRows, 5000)) await clickhouse.insertLogEntries(part);
  for (const row of campaignRows) await clickhouse.insertCampaignEvent(row);
  for (const part of chunk(blocklistRows, 2000)) await clickhouse.insertBlocklistEvents(part);

  await clickhouse.close();
  logger.info(
    {
      signalRows: signalRows.length,
      httpRows: httpRows.length,
      logRows: logRows.length,
      campaignRows: campaignRows.length,
      blocklistRows: blocklistRows.length,
    },
    'ClickHouse seed complete'
  );
}

