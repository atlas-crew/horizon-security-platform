/**
 * Hunt Service
 * Time-based threat hunting with intelligent query routing
 *
 * Query Routing Strategy:
 * - PostgreSQL (<24h): Real-time queries for recent data
 * - ClickHouse (>24h): Historical queries for archived data
 */

import type { PrismaClient, Signal, Prisma, SignalType } from '@prisma/client';
import type { Logger } from 'pino';
import type { ClickHouseService } from '../../storage/clickhouse/index.js';
import type { Severity } from '../../types/protocol.js';
import { type SavedQueryStore, InMemorySavedQueryStore } from './saved-query-store.js';

// =============================================================================
// Query Types
// =============================================================================

export interface HuntQuery {
  tenantId?: string;
  startTime: Date;
  endTime: Date;
  signalTypes?: string[];
  sourceIps?: string[];
  severities?: Severity[];
  minConfidence?: number;
  anonFingerprint?: string;
  limit?: number;
  offset?: number;
}

export interface HuntResult {
  signals: SignalResult[];
  total: number;
  source: 'postgres' | 'clickhouse' | 'hybrid';
  queryTimeMs: number;
}

export interface SignalResult {
  id: string;
  timestamp: Date;
  tenantId: string;
  sensorId: string;
  signalType: string;
  sourceIp: string | null;
  anonFingerprint: string | null;
  severity: Severity;
  confidence: number;
  eventCount: number;
  metadata?: Prisma.JsonValue;
}

export type RequestTimelineEvent =
  | {
      kind: 'http_transaction';
      timestamp: Date;
      tenantId: string;
      sensorId: string;
      requestId: string;
      site: string;
      method: string;
      path: string;
      statusCode: number;
      latencyMs: number;
      wafAction: string | null;
    }
  | {
      kind: 'signal_event';
      timestamp: Date;
      tenantId: string;
      sensorId: string;
      requestId: string;
      signalType: string;
      sourceIp: string;
      severity: string;
      confidence: number;
      eventCount: number;
      metadata: Record<string, unknown> | null;
    }
  | {
      kind: 'sensor_log';
      timestamp: Date;
      tenantId: string;
      sensorId: string;
      requestId: string;
      logId: string;
      source: string;
      level: string;
      message: string;
      fields: Record<string, unknown> | string | null;
      method: string | null;
      path: string | null;
      statusCode: number | null;
      latencyMs: number | null;
      clientIp: string | null;
      ruleId: string | null;
    }
  | {
      kind: 'actor_event';
      timestamp: Date;
      sensorId: string;
      actorId: string;
      requestId: string;
      eventType: string;
      riskScore: number;
      riskDelta: number;
      ruleId: string | null;
      ruleCategory: string | null;
      ip: string;
    }
  | {
      kind: 'session_event';
      timestamp: Date;
      sensorId: string;
      sessionId: string;
      actorId: string;
      requestId: string;
      eventType: string;
      requestCount: number;
    };

export interface RecentRequest {
  requestId: string;
  lastSeenAt: Date;
  sensorId: string;
  path: string;
  statusCode: number;
  wafAction: string | null;
}

export interface CampaignTimelineEvent {
  timestamp: Date;
  campaignId: string;
  eventType: 'created' | 'updated' | 'escalated' | 'resolved';
  name: string;
  status: string;
  severity: string;
  isCrossTenant: boolean;
  tenantsAffected: number;
  confidence: number;
}

export interface HourlyStats {
  hour: Date;
  tenantId: string;
  signalType: string;
  severity: string;
  signalCount: number;
  totalEvents: number;
  uniqueIps: number;
  uniqueFingerprints: number;
}

export interface TenantBaseline {
  signalType: string;
  avgHourlyCount: number;
  stddevHourlyCount: number;
  maxHourlyCount: number;
  observationCount: number;
}

export interface LowAndSlowIpCandidate {
  sourceIp: string;
  daysSeen: number;
  maxDailySignals: number;
  totalSignals: number;
  tenantsHit: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  query: HuntQuery;
  createdBy: string;
  createdAt: Date;
  lastRunAt?: Date;
}

// =============================================================================
// Hunt Service
// =============================================================================

/**
 * Hunt Service for time-based threat hunting.
 * Routes queries to PostgreSQL or ClickHouse based on time range.
 */
export class HuntService {
  private prisma: PrismaClient;
  private clickhouse: ClickHouseService | null;
  private logger: Logger;
  private savedQueries: SavedQueryStore;

  // Time threshold for routing (24 hours in ms)
  private readonly ROUTING_THRESHOLD_MS = 24 * 60 * 60 * 1000;

  constructor(
    prisma: PrismaClient,
    logger: Logger,
    clickhouse?: ClickHouseService,
    savedQueryStore?: SavedQueryStore
  ) {
    this.prisma = prisma;
    this.logger = logger.child({ service: 'hunt' });
    this.clickhouse = clickhouse ?? null;
    this.savedQueries = savedQueryStore ?? new InMemorySavedQueryStore();
  }

  /**
   * Check if ClickHouse is available for historical queries
   */
  isHistoricalEnabled(): boolean {
    return this.clickhouse?.isEnabled() ?? false;
  }

  /**
   * Query signal timeline with intelligent routing
   * - <24h old: PostgreSQL (source of truth)
   * - >24h old: ClickHouse (historical analytics)
   */
  async queryTimeline(query: HuntQuery): Promise<HuntResult> {
    const startTime = Date.now();
    const now = new Date();
    const threshold = new Date(now.getTime() - this.ROUTING_THRESHOLD_MS);

    // Determine routing strategy
    const useClickHouse = this.clickhouse?.isEnabled() && query.startTime < threshold;
    const usePostgres = query.endTime >= threshold;

    if (useClickHouse && usePostgres) {
      // Hybrid query: Split at threshold
      return this.queryHybrid(query, threshold, startTime);
    } else if (useClickHouse) {
      // Pure historical query
      return this.queryClickHouse(query, startTime);
    } else {
      // Pure real-time query
      return this.queryPostgres(query, startTime);
    }
  }

  /**
   * Query PostgreSQL for recent signals
   */
  private async queryPostgres(query: HuntQuery, startTime: number): Promise<HuntResult> {
    const where = this.buildPrismaWhere(query);
    const limit = query.limit ?? 1000;
    const offset = query.offset ?? 0;

    const [signals, total] = await Promise.all([
      this.prisma.signal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.signal.count({ where }),
    ]);

    return {
      signals: signals.map(this.mapSignalToResult),
      total,
      source: 'postgres',
      queryTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Query ClickHouse for historical signals
   */
  private async queryClickHouse(query: HuntQuery, startTime: number): Promise<HuntResult> {
    if (!this.clickhouse) {
      throw new Error('ClickHouse is not enabled');
    }

    const { sql, countSql, params } = this.buildClickHouseQuery(query);

    const [signals, countResult] = await Promise.all([
      this.clickhouse.queryWithParams<ClickHouseSignalRow>(sql, params),
      this.clickhouse.queryOneWithParams<{ count: string }>(countSql, params),
    ]);

    return {
      signals: signals.map(this.mapClickHouseToResult),
      total: parseInt(countResult?.count ?? '0', 10),
      source: 'clickhouse',
      queryTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Hybrid query: Split between PostgreSQL and ClickHouse
   */
  private async queryHybrid(
    query: HuntQuery,
    threshold: Date,
    startTime: number
  ): Promise<HuntResult> {
    // Split query at threshold
    const historicalQuery = { ...query, endTime: threshold };
    const recentQuery = { ...query, startTime: threshold };

    // Run both queries in parallel
    const [historical, recent] = await Promise.all([
      this.queryClickHouse(historicalQuery, startTime),
      this.queryPostgres(recentQuery, startTime),
    ]);

    // Merge results (recent first, then historical)
    const signals = [...recent.signals, ...historical.signals];
    const limit = query.limit ?? 1000;

    return {
      signals: signals.slice(0, limit),
      total: historical.total + recent.total,
      source: 'hybrid',
      queryTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get campaign timeline from ClickHouse
   */
  async getCampaignTimeline(
    campaignId: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<CampaignTimelineEvent[]> {
    if (!this.clickhouse?.isEnabled()) {
      this.logger.warn('ClickHouse not enabled, campaign timeline unavailable');
      return [];
    }

    // Validate inputs
    this.validateIdentifier(campaignId, 'campaignId');

    const start = startTime?.toISOString().replace('T', ' ').replace('Z', '') ?? '1970-01-01 00:00:00';
    const end = endTime?.toISOString().replace('T', ' ').replace('Z', '') ?? new Date().toISOString().replace('T', ' ').replace('Z', '');

    const sql = `
      SELECT
        timestamp,
        campaign_id,
        event_type,
        name,
        status,
        severity,
        is_cross_tenant,
        tenants_affected,
        confidence
      FROM campaign_history
      WHERE campaign_id = {campaignId:String}
        AND timestamp >= toDateTime64({startTime:String}, 3)
        AND timestamp <= toDateTime64({endTime:String}, 3)
      ORDER BY timestamp ASC
    `;

    const params = { campaignId, startTime: start, endTime: end };
    const rows = await this.clickhouse.queryWithParams<ClickHouseCampaignRow>(sql, params);

    return rows.map((row) => ({
      timestamp: new Date(row.timestamp),
      campaignId: row.campaign_id,
      eventType: row.event_type as CampaignTimelineEvent['eventType'],
      name: row.name,
      status: row.status,
      severity: row.severity,
      isCrossTenant: row.is_cross_tenant === 1,
      tenantsAffected: row.tenants_affected,
      confidence: row.confidence,
    }));
  }

  /**
   * Get all ClickHouse events for a single request_id (WAF -> Hub correlation).
   *
   * NOTE: This is ClickHouse-only. PostgreSQL does not currently store request_id.
   */
  async getRequestTimeline(
    tenantId: string,
    requestId: string,
    startTime?: Date,
    endTime?: Date,
    limit: number = 500
  ): Promise<RequestTimelineEvent[]> {
    if (!this.clickhouse?.isEnabled()) {
      this.logger.warn('ClickHouse not enabled, request timeline unavailable');
      return [];
    }

    this.validateIdentifier(tenantId, 'tenantId');
    this.validateRequestId(requestId);

    const maxTotalEvents = this.validatePositiveInt(limit, 1, 5000);
    // `limit` is a total cap across all kinds. We query each table with a smaller per-kind
    // limit to avoid worst-case payloads (5 tables * 5000 rows).
    const perKindLimit = Math.max(1, Math.ceil(maxTotalEvents / 5));

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const start = (startTime ?? defaultStart).toISOString().replace('T', ' ').replace('Z', '');
    const end = (endTime ?? now).toISOString().replace('T', ' ').replace('Z', '');

    const params = { tenantId, requestId, startTime: start, endTime: end, limit: perKindLimit };

    const [httpRows, signalRows, logRows] = await Promise.all([
      this.clickhouse.queryWithParams<ClickHouseHttpTransactionRow>(
        `
          SELECT
            timestamp,
            tenant_id,
            sensor_id,
            request_id,
            site,
            method,
            path,
            status_code,
            latency_ms,
            waf_action
          FROM http_transactions
          WHERE tenant_id = {tenantId:String}
            AND request_id = {requestId:String}
            AND timestamp >= toDateTime64({startTime:String}, 3)
            AND timestamp <= toDateTime64({endTime:String}, 3)
          ORDER BY timestamp ASC
          LIMIT {limit:UInt32}
        `,
        params
      ),
      this.clickhouse.queryWithParams<ClickHouseSignalEventRow>(
        `
          SELECT
            timestamp,
            tenant_id,
            sensor_id,
            request_id,
            signal_type,
            IPv4NumToString(source_ip) AS source_ip,
            severity,
            confidence,
            event_count,
            metadata
          FROM signal_events
          WHERE tenant_id = {tenantId:String}
            AND request_id = {requestId:String}
            AND timestamp >= toDateTime64({startTime:String}, 3)
            AND timestamp <= toDateTime64({endTime:String}, 3)
          ORDER BY timestamp ASC
          LIMIT {limit:UInt32}
        `,
        params
      ),
      this.clickhouse.queryWithParams<ClickHouseLogEntryRow>(
        `
          SELECT
            timestamp,
            tenant_id,
            sensor_id,
            request_id,
            log_id,
            source,
            level,
            message,
            fields,
            method,
            path,
            status_code,
            latency_ms,
            client_ip,
            rule_id
          FROM sensor_logs
          WHERE tenant_id = {tenantId:String}
            AND request_id = {requestId:String}
            AND timestamp >= toDateTime64({startTime:String}, 3)
            AND timestamp <= toDateTime64({endTime:String}, 3)
          ORDER BY timestamp ASC
          LIMIT {limit:UInt32}
        `,
        params
      ),
    ]);

    // SECURITY: actor_events/session_events lack tenant_id. We only query them if we can
    // prove the tenant owns the request via http_transactions, and we scope by the
    // owned sensor_id set.
    //
    // NOTE: This assumes sensor_id is globally unique across tenants. If that invariant
    // is not guaranteed, the correct fix is to add tenant_id to these SOC tables.
    const sensorIds = Array.from(new Set(httpRows.map((r) => r.sensor_id).filter(Boolean)));

    let actorRows: ClickHouseActorEventRow[] = [];
    let sessionRows: ClickHouseSessionEventRow[] = [];
    if (sensorIds.length > 0) {
      const socParams = { ...params, sensorIds };
      [actorRows, sessionRows] = await Promise.all([
        this.clickhouse.queryWithParams<ClickHouseActorEventRow>(
          `
            SELECT
              timestamp,
              sensor_id,
              actor_id,
              request_id,
              event_type,
              risk_score,
              risk_delta,
              rule_id,
              rule_category,
              ip
            FROM actor_events
            WHERE request_id = {requestId:String}
              AND timestamp >= toDateTime64({startTime:String}, 3)
              AND timestamp <= toDateTime64({endTime:String}, 3)
              AND sensor_id IN {sensorIds:Array(String)}
            ORDER BY timestamp ASC
            LIMIT {limit:UInt32}
          `,
          socParams
        ),
        this.clickhouse.queryWithParams<ClickHouseSessionEventRow>(
          `
            SELECT
              timestamp,
              sensor_id,
              session_id,
              actor_id,
              request_id,
              event_type,
              request_count
            FROM session_events
            WHERE request_id = {requestId:String}
              AND timestamp >= toDateTime64({startTime:String}, 3)
              AND timestamp <= toDateTime64({endTime:String}, 3)
              AND sensor_id IN {sensorIds:Array(String)}
            ORDER BY timestamp ASC
            LIMIT {limit:UInt32}
          `,
          socParams
        ),
      ]);
    }

    const events: RequestTimelineEvent[] = [];

    for (const row of httpRows) {
      if (!row.request_id) continue;
      events.push({
        kind: 'http_transaction',
        timestamp: new Date(row.timestamp),
        tenantId: row.tenant_id,
        sensorId: row.sensor_id,
        requestId: row.request_id,
        site: row.site,
        method: row.method,
        path: row.path,
        statusCode: row.status_code,
        latencyMs: row.latency_ms,
        wafAction: row.waf_action ?? null,
      });
    }

    for (const row of signalRows) {
      if (!row.request_id) continue;
      events.push({
        kind: 'signal_event',
        timestamp: new Date(row.timestamp),
        tenantId: row.tenant_id,
        sensorId: row.sensor_id,
        requestId: row.request_id,
        signalType: row.signal_type,
        sourceIp: row.source_ip,
        severity: row.severity,
        confidence: row.confidence,
        eventCount: row.event_count,
        metadata: this.tryParseJson(row.metadata),
      });
    }

    for (const row of logRows) {
      if (!row.request_id) continue;
      events.push({
        kind: 'sensor_log',
        timestamp: new Date(row.timestamp),
        tenantId: row.tenant_id,
        sensorId: row.sensor_id,
        requestId: row.request_id,
        logId: row.log_id,
        source: row.source,
        level: row.level,
        message: row.message,
        fields: this.tryParseJsonRaw(row.fields),
        method: row.method ?? null,
        path: row.path ?? null,
        statusCode: row.status_code ?? null,
        latencyMs: row.latency_ms ?? null,
        clientIp: row.client_ip ?? null,
        ruleId: row.rule_id ?? null,
      });
    }

    for (const row of actorRows) {
      if (!row.request_id) continue;
      events.push({
        kind: 'actor_event',
        timestamp: new Date(row.timestamp),
        sensorId: row.sensor_id,
        actorId: row.actor_id,
        requestId: row.request_id,
        eventType: row.event_type,
        riskScore: row.risk_score,
        riskDelta: row.risk_delta,
        ruleId: row.rule_id ?? null,
        ruleCategory: row.rule_category ?? null,
        ip: row.ip,
      });
    }

    for (const row of sessionRows) {
      if (!row.request_id) continue;
      events.push({
        kind: 'session_event',
        timestamp: new Date(row.timestamp),
        sensorId: row.sensor_id,
        sessionId: row.session_id,
        actorId: row.actor_id,
        requestId: row.request_id,
        eventType: row.event_type,
        requestCount: row.request_count,
      });
    }

    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return events.length > maxTotalEvents ? events.slice(0, maxTotalEvents) : events;
  }

  async getRecentRequests(tenantId: string, limit: number = 25): Promise<RecentRequest[]> {
    if (!this.clickhouse?.isEnabled()) {
      this.logger.warn('ClickHouse not enabled, recent requests unavailable');
      return [];
    }

    this.validateIdentifier(tenantId, 'tenantId');
    const boundedLimit = this.validatePositiveInt(limit, 1, 200);

    const rows = await this.clickhouse.queryWithParams<ClickHouseRecentRequestRow>(
      `
        SELECT
          request_id,
          max(timestamp) AS last_seen,
          argMax(sensor_id, timestamp) AS sensor_id,
          argMax(path, timestamp) AS path,
          argMax(status_code, timestamp) AS status_code,
          argMax(waf_action, timestamp) AS waf_action
        FROM http_transactions
        WHERE tenant_id = {tenantId:String}
          AND request_id IS NOT NULL
          AND request_id != ''
        GROUP BY request_id
        ORDER BY last_seen DESC
        LIMIT {limit:UInt32}
      `,
      { tenantId, limit: boundedLimit }
    );

    return rows.map((row) => ({
      requestId: row.request_id,
      lastSeenAt: new Date(row.last_seen),
      sensorId: row.sensor_id,
      path: row.path,
      statusCode: row.status_code,
      wafAction: row.waf_action ?? null,
    }));
  }

  /**
   * Find "low and slow" IPs (cross-tenant) that persist across many days but never spike in a single day.
   * NOTE: Uses ip_daily_mv which aggregates across tenants; treat as admin-only intelligence.
   */
  async getLowAndSlowIps(params?: {
    days?: number;
    minDistinctDays?: number;
    maxSignalsPerDay?: number;
    limit?: number;
  }): Promise<LowAndSlowIpCandidate[]> {
    if (!this.clickhouse?.isEnabled()) return [];

    const days = this.validatePositiveInt(params?.days ?? 90, 1, 365);
    const minDistinctDays = this.validatePositiveInt(params?.minDistinctDays ?? 5, 2, days);
    const maxSignalsPerDay = this.validatePositiveInt(params?.maxSignalsPerDay ?? 10, 1, 100000);
    const limit = this.validatePositiveInt(params?.limit ?? 100, 1, 1000);

    const sql = `
      WITH daily AS (
        SELECT
          source_ip,
          day,
          countMerge(signal_count_state) AS signals
        FROM ip_daily_mv
        WHERE day >= today() - INTERVAL {days:UInt32} DAY
        GROUP BY source_ip, day
      ),
      summary AS (
        SELECT
          source_ip,
          count() AS days_seen,
          max(signals) AS max_daily_signals,
          sum(signals) AS total_signals
        FROM daily
        GROUP BY source_ip
        HAVING days_seen >= {minDistinctDays:UInt32}
          AND max_daily_signals <= {maxSignalsPerDay:UInt32}
      ),
      tenants AS (
        SELECT
          source_ip,
          uniqMerge(tenants_hit_state) AS tenants_hit
        FROM ip_daily_mv
        WHERE day >= today() - INTERVAL {days:UInt32} DAY
        GROUP BY source_ip
      )
      SELECT
        IPv4NumToString(summary.source_ip) AS source_ip,
        summary.days_seen,
        summary.max_daily_signals,
        summary.total_signals,
        tenants.tenants_hit
      FROM summary
      LEFT JOIN tenants ON tenants.source_ip = summary.source_ip
      ORDER BY summary.days_seen DESC, summary.total_signals DESC
      LIMIT {limit:UInt32}
    `;

    const rows = await this.clickhouse.queryWithParams<{
      source_ip: string;
      days_seen: string;
      max_daily_signals: number;
      total_signals: number;
      tenants_hit: number;
    }>(sql, { days, minDistinctDays, maxSignalsPerDay, limit });

    return rows.map((r) => ({
      sourceIp: r.source_ip,
      daysSeen: parseInt(r.days_seen, 10),
      maxDailySignals: r.max_daily_signals,
      totalSignals: r.total_signals,
      tenantsHit: r.tenants_hit,
    }));
  }

  /**
   * Get hourly aggregated statistics from materialized view
   */
  async getHourlyStats(
    tenantId?: string,
    startTime?: Date,
    endTime?: Date,
    signalTypes?: string[]
  ): Promise<HourlyStats[]> {
    if (!this.clickhouse?.isEnabled()) {
      this.logger.warn('ClickHouse not enabled, hourly stats unavailable');
      return [];
    }

    // Validate inputs
    if (tenantId) {
      this.validateIdentifier(tenantId, 'tenantId');
    }
    if (signalTypes) {
      signalTypes.forEach((t, i) => this.validateIdentifier(t, `signalTypes[${i}]`));
    }

    const start = startTime?.toISOString().replace('T', ' ').replace('Z', '')
      ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
    const end = endTime?.toISOString().replace('T', ' ').replace('Z', '')
      ?? new Date().toISOString().replace('T', ' ').replace('Z', '');

    const params: Record<string, unknown> = { startTime: start, endTime: end };
    const whereClauses: string[] = [
      'hour >= toStartOfHour(toDateTime64({startTime:String}, 3))',
      'hour <= toStartOfHour(toDateTime64({endTime:String}, 3))',
    ];

    if (tenantId) {
      whereClauses.push('tenant_id = {tenantId:String}');
      params.tenantId = tenantId;
    }

    if (signalTypes && signalTypes.length > 0) {
      whereClauses.push('signal_type IN {signalTypes:Array(String)}');
      params.signalTypes = signalTypes;
    }

    const sql = `
      SELECT
        hour,
        tenant_id,
        signal_type,
        severity,
        signal_count,
        total_events,
        unique_ips,
        unique_fingerprints
      FROM signal_hourly_mv
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY hour DESC
      LIMIT 1000
    `;

    const rows = await this.clickhouse.queryWithParams<ClickHouseHourlyRow>(sql, params);

    return rows.map((row) => ({
      hour: new Date(row.hour),
      tenantId: row.tenant_id,
      signalType: row.signal_type,
      severity: row.severity,
      signalCount: row.signal_count,
      totalEvents: row.total_events,
      uniqueIps: row.unique_ips,
      uniqueFingerprints: row.unique_fingerprints,
    }));
  }

  /**
   * Establish behavioral baselines for a tenant using historical data.
   * Calculates mean and standard deviation for each signal type.
   */
  async getTenantBaselines(tenantId: string, days: number = 30): Promise<TenantBaseline[]> {
    if (!this.clickhouse?.isEnabled()) {
      this.logger.warn('ClickHouse not enabled, tenant baselines unavailable');
      return [];
    }

    this.validateIdentifier(tenantId, 'tenantId');
    const validDays = this.validatePositiveInt(days, 1, 90);

    const sql = `
      SELECT
        signal_type,
        avg(hour_total) AS avg_count,
        stddevPop(hour_total) AS stddev_count,
        max(hour_total) AS max_count,
        count() AS observation_count
      FROM (
        /* Aggregate across severities first, then compute distribution across hours. */
        SELECT
          hour,
          signal_type,
          sum(signal_count) AS hour_total
        FROM signal_hourly_mv
        WHERE tenant_id = {tenantId:String}
          AND hour >= toStartOfHour(now()) - INTERVAL {days:UInt32} DAY
          AND hour < toStartOfHour(now())
        GROUP BY hour, signal_type
      )
      GROUP BY signal_type
    `;

    const params = { tenantId, days: validDays };
    const rows = await this.clickhouse.queryWithParams<{
      signal_type: string;
      avg_count: number;
      stddev_count: number;
      max_count: number;
      observation_count: string;
    }>(sql, params);

    return rows.map((row) => ({
      signalType: row.signal_type,
      avgHourlyCount: row.avg_count,
      stddevHourlyCount: row.stddev_count,
      maxHourlyCount: row.max_count,
      observationCount: parseInt(row.observation_count, 10),
    }));
  }

  /**
   * Identify current signal anomalies by comparing recent activity to baselines.
   * Flags any signal type exceeding (mean + Z*stddev).
   */
  async getAnomalies(tenantId: string, zScoreThreshold: number = 2.0): Promise<{
    signalType: string;
    currentCount: number;
    expectedAvg: number;
    deviation: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }[]> {
    if (!this.clickhouse?.isEnabled()) return [];

    const boundedZ = this.validateFloat(zScoreThreshold, 0.1, 10);

    // Use the most recent *complete* hour bucket to avoid partial-hour noise.
    const now = new Date();
    const thisHour = new Date(now);
    thisHour.setMinutes(0, 0, 0);
    const lastCompleteHour = new Date(thisHour.getTime() - 60 * 60 * 1000);

    const [baselines, recent] = await Promise.all([
      this.getTenantBaselines(tenantId),
      this.getHourlyStats(tenantId, lastCompleteHour, lastCompleteHour)
    ]);

    const anomalies: {
      signalType: string;
      currentCount: number;
      expectedAvg: number;
      deviation: number;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }[] = [];

    for (const base of baselines) {
      // FIX: Sum all severity buckets for this signal type to avoid dimensional mismatch
      const currentCount = recent
        .filter(r => r.signalType === base.signalType)
        .reduce((sum, r) => sum + r.signalCount, 0);

      const threshold = base.avgHourlyCount + (boundedZ * base.stddevHourlyCount);

      if (currentCount > threshold) {
        let deviation = 0;
        if (base.stddevHourlyCount > 0) {
          deviation = (currentCount - base.avgHourlyCount) / base.stddevHourlyCount;
        } else if (currentCount > base.avgHourlyCount) {
          // Zero stddev but count increased: treat as a high-sigma event (e.g. 10.0)
          // to ensure it's surfaced as HIGH severity.
          deviation = 10.0;
        }

        if (deviation > 0) {
          anomalies.push({
            signalType: base.signalType,
            currentCount,
            expectedAvg: base.avgHourlyCount,
            deviation,
            severity: deviation > 5 ? 'HIGH' : (deviation > 3 ? 'MEDIUM' : 'LOW')
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Get IP activity across tenants (for threat hunting)
   */
  async getIpActivity(
    sourceIp: string,
    days: number = 30
  ): Promise<{
    totalHits: number;
    tenantsHit: number;
    firstSeen: Date | null;
    lastSeen: Date | null;
    signalTypes: string[];
  }> {
    // Validate inputs
    this.validateIpAddress(sourceIp, 'sourceIp');
    const validDays = this.validatePositiveInt(days, 1, 365);

    if (!this.clickhouse?.isEnabled()) {
      // Fall back to PostgreSQL for recent data
      const signals = await this.prisma.signal.findMany({
        where: {
          sourceIp,
          createdAt: { gte: new Date(Date.now() - validDays * 24 * 60 * 60 * 1000) },
        },
        select: { tenantId: true, signalType: true, createdAt: true },
      });

      const tenants = new Set(signals.map((s) => s.tenantId));
      const types = new Set(signals.map((s) => s.signalType));
      const times = signals.map((s) => s.createdAt);

      return {
        totalHits: signals.length,
        tenantsHit: tenants.size,
        firstSeen: times.length > 0 ? new Date(Math.min(...times.map((t) => t.getTime()))) : null,
        lastSeen: times.length > 0 ? new Date(Math.max(...times.map((t) => t.getTime()))) : null,
        signalTypes: Array.from(types),
      };
    }

    const sql = `
      SELECT
        count() AS total_hits,
        uniq(tenant_id) AS tenants_hit,
        min(timestamp) AS first_seen,
        max(timestamp) AS last_seen,
        groupUniqArray(signal_type) AS signal_types
      FROM signal_events
      WHERE source_ip = toIPv4({sourceIp:String})
        AND timestamp >= now() - INTERVAL {days:UInt32} DAY
    `;

    const params = { sourceIp, days: validDays };
    const result = await this.clickhouse.queryOneWithParams<{
      total_hits: string;
      tenants_hit: string;
      first_seen: string;
      last_seen: string;
      signal_types: string[];
    }>(sql, params);

    if (!result) {
      return {
        totalHits: 0,
        tenantsHit: 0,
        firstSeen: null,
        lastSeen: null,
        signalTypes: [],
      };
    }

    return {
      totalHits: parseInt(result.total_hits, 10),
      tenantsHit: parseInt(result.tenants_hit, 10),
      firstSeen: result.first_seen ? new Date(result.first_seen) : null,
      lastSeen: result.last_seen ? new Date(result.last_seen) : null,
      signalTypes: result.signal_types,
    };
  }

  // =============================================================================
  // Saved Queries (Persistent across instances)
  // =============================================================================

  async saveQuery(
    name: string,
    query: HuntQuery,
    createdBy: string,
    description?: string
  ): Promise<SavedQuery> {
    const saved: SavedQuery = {
      id: crypto.randomUUID(),
      name,
      description,
      query,
      createdBy,
      createdAt: new Date(),
    };

    await this.savedQueries.set(saved);
    this.logger.info({ queryId: saved.id, name }, 'Saved hunt query');

    return saved;
  }

  async getSavedQueries(createdBy?: string): Promise<SavedQuery[]> {
    return this.savedQueries.list(createdBy);
  }

  async getSavedQuery(id: string): Promise<SavedQuery | null> {
    return this.savedQueries.get(id);
  }

  async deleteSavedQuery(id: string): Promise<boolean> {
    return this.savedQueries.delete(id);
  }

  async runSavedQuery(id: string): Promise<HuntResult | null> {
    const saved = await this.savedQueries.get(id);
    if (!saved) return null;

    saved.lastRunAt = new Date();
    await this.savedQueries.set(saved);
    return this.queryTimeline(saved.query);
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  private buildPrismaWhere(query: HuntQuery): Prisma.SignalWhereInput {
    const where: Prisma.SignalWhereInput = {
      createdAt: {
        gte: query.startTime,
        lte: query.endTime,
      },
    };

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.signalTypes && query.signalTypes.length > 0) {
      where.signalType = { in: query.signalTypes as SignalType[] };
    }

    if (query.sourceIps && query.sourceIps.length > 0) {
      const exact: string[] = [];
      const prefixes: string[] = [];

      for (const raw of query.sourceIps) {
        // Validation already ran for ClickHouse path; for Postgres-only just be safe.
        this.validateIpAddress(raw, 'sourceIps');

        // Prefix filters end with '.' (e.g. "185.228.")
        if (raw.endsWith('.')) {
          prefixes.push(raw);
          continue;
        }

        // CIDR is ClickHouse-only for now; in Postgres fallback treat as exact IP if /32, otherwise ignore.
        if (raw.includes('/')) {
          const [ip, bitsStr] = raw.split('/');
          if (bitsStr === '32') exact.push(ip);
          continue;
        }

        exact.push(raw);
      }

      if (prefixes.length === 0) {
        where.sourceIp = { in: exact };
      } else {
        const or: Prisma.SignalWhereInput[] = [];
        if (exact.length > 0) or.push({ sourceIp: { in: exact } });
        for (const p of prefixes) {
          // Stored as string; use startsWith semantics.
          or.push({ sourceIp: { startsWith: p } });
        }
        where.OR = (where.OR || []).concat(or);
      }
    }

    if (query.severities && query.severities.length > 0) {
      where.severity = { in: query.severities };
    }

    if (query.minConfidence !== undefined) {
      where.confidence = { gte: query.minConfidence };
    }

    if (query.anonFingerprint) {
      where.anonFingerprint = query.anonFingerprint;
    }

    return where;
  }

  private buildClickHouseQuery(query: HuntQuery): { sql: string; countSql: string; params: Record<string, unknown> } {
    // Validate and sanitize numeric inputs
    const limit = this.validatePositiveInt(query.limit ?? 1000, 1, 10000);
    const offset = this.validatePositiveInt(query.offset ?? 0, 0, 1000000);
    const minConfidence = query.minConfidence !== undefined
      ? this.validateFloat(query.minConfidence, 0, 1)
      : undefined;

    // Build parameterized query
    const params: Record<string, unknown> = {
      startTime: query.startTime.toISOString().replace('T', ' ').replace('Z', ''),
      endTime: query.endTime.toISOString().replace('T', ' ').replace('Z', ''),
      limit,
      offset,
    };

    const whereClauses: string[] = [
      'timestamp >= toDateTime64({startTime:String}, 3)',
      'timestamp <= toDateTime64({endTime:String}, 3)',
    ];

    if (query.tenantId) {
      this.validateIdentifier(query.tenantId, 'tenantId');
      whereClauses.push('tenant_id = {tenantId:String}');
      params.tenantId = query.tenantId;
    }

    if (query.signalTypes && query.signalTypes.length > 0) {
      query.signalTypes.forEach((t, i) => this.validateIdentifier(t, `signalTypes[${i}]`));
      whereClauses.push('signal_type IN {signalTypes:Array(String)}');
      params.signalTypes = query.signalTypes;
    }

    if (query.sourceIps && query.sourceIps.length > 0) {
      const exactIps: string[] = [];
      const prefixIps: string[] = [];

      query.sourceIps.forEach((ip, i) => {
        this.validateIpAddress(ip, `sourceIps[${i}]`);
        if (ip.endsWith('.')) {
          prefixIps.push(ip);
        } else if (ip.includes('/')) {
          // CIDR unsupported in ClickHouse query for now (would require parsing to range).
          // Accept /32 as exact IP.
          const [cidrIp, bits] = ip.split('/');
          if (bits === '32') exactIps.push(cidrIp);
        } else {
          exactIps.push(ip);
        }
      });

      const ipClauses: string[] = [];
      if (exactIps.length > 0) {
        ipClauses.push('source_ip IN {sourceIps:Array(IPv4)}');
        params.sourceIps = exactIps;
      }

      if (prefixIps.length > 0) {
        // NOTE: source_ip is IPv4 type; convert to string for prefix matching.
        ipClauses.push('startsWith(IPv4NumToString(source_ip), {sourceIpPrefix:String})');
        // If multiple prefixes are provided, use OR of parameters.
        // Keep it simple: if multiple, use first (UI typically sends one).
        params.sourceIpPrefix = prefixIps[0];
      }

      if (ipClauses.length === 1) {
        whereClauses.push(ipClauses[0]);
      } else if (ipClauses.length > 1) {
        whereClauses.push(`(${ipClauses.join(' OR ')})`);
      }
    }

    if (query.severities && query.severities.length > 0) {
      query.severities.forEach((s, i) => this.validateIdentifier(s, `severities[${i}]`));
      whereClauses.push('severity IN {severities:Array(String)}');
      params.severities = query.severities;
    }

    if (minConfidence !== undefined) {
      whereClauses.push('confidence >= {minConfidence:Float64}');
      params.minConfidence = minConfidence;
    }

    if (query.anonFingerprint) {
      this.validateIdentifier(query.anonFingerprint, 'anonFingerprint');
      whereClauses.push('anon_fingerprint = {anonFingerprint:String}');
      params.anonFingerprint = query.anonFingerprint;
    }

    const whereClause = whereClauses.join(' AND ');

    const sql = `
      SELECT
        generateUUIDv4() AS id,
        timestamp,
        tenant_id,
        sensor_id,
        signal_type,
        IPv4NumToString(source_ip) AS source_ip,
        anon_fingerprint,
        severity,
        confidence,
        event_count,
        metadata
      FROM signal_events
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const countSql = `
      SELECT count() AS count
      FROM signal_events
      WHERE ${whereClause}
    `;

    return { sql, countSql, params };
  }

  private mapSignalToResult(signal: Signal): SignalResult {
    return {
      id: signal.id,
      timestamp: signal.createdAt,
      tenantId: signal.tenantId,
      sensorId: signal.sensorId,
      signalType: signal.signalType,
      sourceIp: signal.sourceIp,
      anonFingerprint: signal.anonFingerprint,
      severity: signal.severity as Severity,
      confidence: signal.confidence,
      eventCount: signal.eventCount,
      metadata: signal.metadata,
    };
  }

  private mapClickHouseToResult(row: ClickHouseSignalRow): SignalResult {
    let parsedMetadata = {};
    try {
      if (row.metadata) {
        parsedMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      }
    } catch {
      // Ignore parse errors
    }

    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      tenantId: row.tenant_id,
      sensorId: row.sensor_id,
      signalType: row.signal_type,
      sourceIp: row.source_ip || null,
      anonFingerprint: row.anon_fingerprint || null,
      severity: row.severity as Severity,
      confidence: row.confidence,
      eventCount: row.event_count,
      metadata: parsedMetadata,
    };
  }

  // =============================================================================
  // Input Validation Helpers (SQL Injection Prevention)
  // =============================================================================

  /**
   * Validate a positive integer within bounds
   * @throws Error if value is not a valid integer within bounds
   */
  private validatePositiveInt(value: number, min: number, max: number): number {
    if (!Number.isInteger(value) || !Number.isFinite(value)) {
      throw new Error(`Invalid integer value: ${value}`);
    }
    if (value < min || value > max) {
      throw new Error(`Value ${value} out of range [${min}, ${max}]`);
    }
    return value;
  }

  /**
   * Validate a floating point number within bounds
   * @throws Error if value is not a valid number within bounds
   */
  private validateFloat(value: number, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Invalid float value: ${value}`);
    }
    if (value < min || value > max) {
      throw new Error(`Value ${value} out of range [${min}, ${max}]`);
    }
    return value;
  }

  /**
   * Validate an identifier (tenant ID, signal type, fingerprint, etc.)
   * Allows alphanumeric, hyphens, underscores, and periods (for UUIDs and domains)
   * @throws Error if identifier contains invalid characters
   */
  private validateIdentifier(value: string, fieldName: string): void {
    if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
      throw new Error(`Invalid ${fieldName}: must be a non-empty string <= 256 chars`);
    }
    // Allow alphanumeric, hyphen, underscore, period, colon (for namespaced types)
    const validPattern = /^[a-zA-Z0-9_\-.:]+$/;
    if (!validPattern.test(value)) {
      throw new Error(`Invalid ${fieldName}: contains disallowed characters`);
    }
  }

  /**
   * Validate an IP filter.
   *
   * Supported formats:
   * - Exact IP: "203.0.113.10", "2001:db8::1"
   * - IPv4 CIDR: "203.0.113.0/24"
   * - IPv4 prefix: "185.228." or "185.228.101." (1-3 octets + trailing dot)
   * @throws Error if not a valid IP address
   */
  private validateIpAddress(value: string, fieldName: string): void {
    if (typeof value !== 'string') {
      throw new Error(`Invalid ${fieldName}: must be a string`);
    }
    if (value.length === 0 || value.length > 64) {
      throw new Error(`Invalid ${fieldName}: must be 1-64 chars`);
    }

    // IPv4 prefix "x." / "x.y." / "x.y.z."
    const ipv4PrefixPattern = /^(\d{1,3}\.){1,3}$/;
    if (ipv4PrefixPattern.test(value)) {
      const octets = value.split('.').filter(Boolean).map(Number);
      if (octets.some((o) => o < 0 || o > 255)) {
        throw new Error(`Invalid ${fieldName}: IP prefix octets must be 0-255`);
      }
      return;
    }

    // IPv4 CIDR "x.y.z.w/n"
    const ipv4CidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (ipv4CidrPattern.test(value)) {
      const [ip, bitsStr] = value.split('/');
      const bits = Number(bitsStr);
      if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
        throw new Error(`Invalid ${fieldName}: CIDR bits must be 0-32`);
      }
      const octets = ip.split('.').map(Number);
      if (octets.some((o) => o < 0 || o > 255)) {
        throw new Error(`Invalid ${fieldName}: IP address octets must be 0-255`);
      }
      return;
    }

    // Basic IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // Basic IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    if (!ipv4Pattern.test(value) && !ipv6Pattern.test(value)) {
      throw new Error(`Invalid ${fieldName}: not a valid IP address`);
    }

    // Additional IPv4 validation - each octet must be 0-255
    if (ipv4Pattern.test(value)) {
      const octets = value.split('.').map(Number);
      if (octets.some((o) => o < 0 || o > 255)) {
        throw new Error(`Invalid ${fieldName}: IP address octets must be 0-255`);
      }
    }
  }

  private validateRequestId(value: string): void {
    // Keep aligned with Hub ingest validation (apps/signal-horizon/api/src/api/telemetry.ts).
    const maxLen = 128;
    const pattern = /^[A-Za-z0-9._-]+$/;
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLen) {
      throw new Error('Invalid requestId');
    }
    if (value.includes('\r') || value.includes('\n') || !pattern.test(value)) {
      throw new Error('Invalid requestId');
    }
  }

  private tryParseJson(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private tryParseJsonRaw(value: unknown): Record<string, unknown> | string | null {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
      return value;
    } catch {
      return value;
    }
  }

}

// =============================================================================
// ClickHouse Row Types
// =============================================================================

interface ClickHouseSignalRow {
  id: string;
  timestamp: string;
  tenant_id: string;
  sensor_id: string;
  signal_type: string;
  source_ip: string;
  anon_fingerprint: string;
  severity: string;
  confidence: number;
  event_count: number;
  metadata?: string | Record<string, unknown> | null;
}

interface ClickHouseCampaignRow {
  timestamp: string;
  campaign_id: string;
  event_type: string;
  name: string;
  status: string;
  severity: string;
  is_cross_tenant: 0 | 1;
  tenants_affected: number;
  confidence: number;
}

interface ClickHouseHourlyRow {
  hour: string;
  tenant_id: string;
  signal_type: string;
  severity: string;
  signal_count: number;
  total_events: number;
  unique_ips: number;
  unique_fingerprints: number;
}

interface ClickHouseHttpTransactionRow {
  timestamp: string;
  tenant_id: string;
  sensor_id: string;
  request_id: string | null;
  site: string;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  waf_action: string | null;
}

interface ClickHouseRecentRequestRow {
  request_id: string;
  last_seen: string;
  sensor_id: string;
  path: string;
  status_code: number;
  waf_action: string | null;
}

interface ClickHouseSignalEventRow {
  timestamp: string;
  tenant_id: string;
  sensor_id: string;
  request_id: string | null;
  signal_type: string;
  source_ip: string;
  severity: string;
  confidence: number;
  event_count: number;
  metadata?: string | Record<string, unknown> | null;
}

interface ClickHouseLogEntryRow {
  timestamp: string;
  tenant_id: string;
  sensor_id: string;
  request_id: string | null;
  log_id: string;
  source: string;
  level: string;
  message: string;
  fields: string | Record<string, unknown> | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  latency_ms: number | null;
  client_ip: string | null;
  rule_id: string | null;
}

interface ClickHouseActorEventRow {
  timestamp: string;
  sensor_id: string;
  actor_id: string;
  request_id: string | null;
  event_type: string;
  risk_score: number;
  risk_delta: number;
  rule_id: string | null;
  rule_category: string | null;
  ip: string;
}

interface ClickHouseSessionEventRow {
  timestamp: string;
  sensor_id: string;
  session_id: string;
  actor_id: string;
  request_id: string | null;
  event_type: string;
  request_count: number;
}
