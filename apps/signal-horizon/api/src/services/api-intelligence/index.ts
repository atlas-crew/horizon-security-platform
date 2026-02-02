/**
 * API Intelligence Service
 * Aggregates TEMPLATE_DISCOVERY and SCHEMA_VIOLATION signals from sensors
 *
 * This service handles:
 * - Signal ingestion (single and batch)
 * - Endpoint discovery tracking
 * - Schema violation monitoring
 * - Discovery statistics and trends
 */

import type { Prisma, PrismaClient, SignalType } from '@prisma/client';
import type { Logger } from 'pino';
import { EventEmitter } from 'events';
import type {
  APIIntelligenceSignal,
  SignalBatch,
  DiscoveryStats,
  ViolationTrend,
  BatchIngestionResult,
} from '../../schemas/api-intelligence.js';

// =============================================================================
// Service Events
// =============================================================================

export interface APIIntelligenceEvents {
  signal: { signal: APIIntelligenceSignal; tenantId: string };
  endpointDiscovered: { templatePattern: string; method: string; tenantId: string };
  schemaViolation: { endpoint: string; violationType: string; tenantId: string };
}

interface DiscoverySignalContext {
  tenantId: string;
  sensorId: string;
  signalType: 'TEMPLATE_DISCOVERY' | 'SCHEMA_VIOLATION';
  metadata?: Record<string, unknown>;
}

interface DiscoverySignalOptions {
  signalId?: string;
  swallowErrors?: boolean;
  emitEvents?: boolean;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * API Intelligence Service for aggregating endpoint discovery and schema violation signals
 */
export class APIIntelligenceService extends EventEmitter {
  private logger: Logger;

  constructor(
    private prisma: PrismaClient,
    logger: Logger
  ) {
    super();
    this.logger = logger.child({ service: 'api-intelligence' });
  }

  // ===========================================================================
  // Signal Ingestion
  // ===========================================================================

  /**
   * Ingest a single signal from a sensor
   */
  async ingestSignal(signal: APIIntelligenceSignal, tenantId: string): Promise<void> {
    this.logger.debug({ signal, tenantId }, 'Ingesting API intelligence signal');

    if (signal.type === 'TEMPLATE_DISCOVERY') {
      await this.handleTemplateDiscovery(signal, tenantId);
    } else if (signal.type === 'SCHEMA_VIOLATION') {
      await this.handleSchemaViolation(signal, tenantId);
    }

    // Emit for real-time dashboard updates
    this.emit('signal', { signal, tenantId });
  }

  /**
   * Ingest a batch of signals
   */
  async ingestBatch(batch: SignalBatch, tenantId: string): Promise<BatchIngestionResult> {
    let accepted = 0;
    let rejected = 0;

    this.logger.info(
      { batchId: batch.batchId, signalCount: batch.signals.length, tenantId },
      'Processing signal batch'
    );

    for (const signal of batch.signals) {
      try {
        await this.ingestSignal(signal, tenantId);
        accepted++;
      } catch (error) {
        this.logger.warn({ signal, error }, 'Failed to ingest signal');
        rejected++;
      }
    }

    this.logger.info(
      { batchId: batch.batchId, accepted, rejected },
      'Batch processing complete'
    );

    return { accepted, rejected, batchId: batch.batchId };
  }

  // ===========================================================================
  // Signal Handlers
  // ===========================================================================

  /**
   * Handle TEMPLATE_DISCOVERY signal
   */
  private async handleTemplateDiscovery(
    signal: APIIntelligenceSignal,
    tenantId: string
  ): Promise<void> {
    if (!signal.templatePattern) {
      throw new Error('TEMPLATE_DISCOVERY requires templatePattern');
    }

    const result = await this.processDiscoverySignal(
      {
        tenantId,
        sensorId: signal.sensorId,
        signalType: 'TEMPLATE_DISCOVERY',
        metadata: this.buildMetadataFromSignal(signal),
      }
    );

    if (result?.created) {
      // Emit endpoint discovered event
      this.emit('endpointDiscovered', {
        templatePattern: signal.templatePattern,
        method: signal.method,
        tenantId,
      });

      this.logger.info(
        {
          templatePattern: signal.templatePattern,
          method: signal.method,
          tenantId,
        },
        'New API endpoint discovered'
      );
    }

    // Store signal for history
    await this.storeSignal(signal, tenantId);
  }

  /**
   * Handle SCHEMA_VIOLATION signal
   */
  private async handleSchemaViolation(
    signal: APIIntelligenceSignal,
    tenantId: string
  ): Promise<void> {
    await this.processDiscoverySignal({
      tenantId,
      sensorId: signal.sensorId,
      signalType: 'SCHEMA_VIOLATION',
      metadata: this.buildMetadataFromSignal(signal),
    });

    // Store the violation signal
    await this.storeSignal(signal, tenantId);

    // Emit violation event for real-time monitoring
    this.emit('schemaViolation', {
      endpoint: signal.endpoint,
      violationType: signal.violationType ?? 'unknown',
      tenantId,
    });

    this.logger.warn(
      {
        endpoint: signal.endpoint,
        violationType: signal.violationType,
        violationPath: signal.violationPath,
        tenantId,
      },
      'Schema violation detected'
    );
  }

  /**
   * Store signal in the Signal table for history and analysis
   */
  private async storeSignal(signal: APIIntelligenceSignal, tenantId: string): Promise<void> {
    await this.prisma.signal.create({
      data: {
        tenantId,
        sensorId: signal.sensorId,
        signalType: signal.type as SignalType,
        sourceIp: null, // API intelligence signals don't have source IP
        fingerprint: signal.templatePattern ?? signal.endpoint,
        severity: signal.type === 'SCHEMA_VIOLATION' ? 'MEDIUM' : 'LOW',
        confidence: signal.discoveryConfidence ?? 1.0,
        eventCount: 1,
        metadata: {
          endpoint: signal.endpoint,
          method: signal.method,
          templatePattern: signal.templatePattern,
          violationType: signal.violationType,
          violationPath: signal.violationPath,
          violationMessage: signal.violationMessage,
          parameterTypes: signal.parameterTypes,
        },
      },
    });
  }

  // ===========================================================================
  // Discovery Processing
  // ===========================================================================

  async processDiscoverySignal(
    context: DiscoverySignalContext,
    options: DiscoverySignalOptions = {}
  ): Promise<{ created: boolean; endpointId: string } | null> {
    try {
      const metadata = context.metadata ?? {};
      const { endpointId, created } = await this.upsertEndpointFromMetadata(
        context.tenantId,
        context.sensorId,
        metadata
      );

      if (context.signalType === 'SCHEMA_VIOLATION') {
        await this.recordSchemaViolation(endpointId, context.tenantId, metadata);
      }

      if (options.emitEvents) {
        const eventSignal = this.buildEventSignal(context, metadata);
        this.emit('signal', { signal: eventSignal, tenantId: context.tenantId });

        if (created && eventSignal.templatePattern) {
          this.emit('endpointDiscovered', {
            templatePattern: eventSignal.templatePattern,
            method: eventSignal.method,
            tenantId: context.tenantId,
          });
        }

        if (context.signalType === 'SCHEMA_VIOLATION') {
          this.emit('schemaViolation', {
            endpoint: eventSignal.endpoint,
            violationType: eventSignal.violationType ?? 'unknown',
            tenantId: context.tenantId,
          });
        }
      }

      return { created, endpointId };
    } catch (error) {
      this.logger.error(
        { error, signalId: options.signalId, signalType: context.signalType },
        'Failed to process discovery signal'
      );
      if (options.swallowErrors) {
        return null;
      }
      throw error;
    }
  }

  private buildMetadataFromSignal(signal: APIIntelligenceSignal): Record<string, unknown> {
    return {
      method: signal.method,
      template: signal.templatePattern ?? signal.endpoint,
      path: signal.endpoint,
      service: 'discovered',
      schema: signal.expectedSchema,
      parameters: signal.parameterTypes,
      field: signal.violationPath,
      violationType: signal.violationType,
      expectedType: this.coerceString(signal.expectedSchema),
      receivedType: this.coerceString(signal.actualPayload),
    };
  }

  private buildEventSignal(
    context: DiscoverySignalContext,
    metadata: Record<string, unknown>
  ): APIIntelligenceSignal {
    const method = typeof metadata.method === 'string' ? metadata.method.toUpperCase() : 'GET';
    const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
    const normalizedMethod = allowedMethods.has(method) ? method : 'GET';
    const templatePattern = typeof metadata.template === 'string' && metadata.template.length > 0
      ? metadata.template
      : undefined;
    const endpoint = typeof metadata.path === 'string' && metadata.path.length > 0
      ? metadata.path
      : templatePattern ?? 'unknown';
    const violationType = typeof metadata.violationType === 'string'
      ? metadata.violationType
      : undefined;
    const violationPath = typeof metadata.field === 'string' ? metadata.field : undefined;

    return {
      type: context.signalType,
      sensorId: context.sensorId,
      timestamp: new Date().toISOString(),
      endpoint,
      method: normalizedMethod as APIIntelligenceSignal['method'],
      templatePattern,
      violationType,
      violationPath,
    };
  }

  private async upsertEndpointFromMetadata(
    tenantId: string,
    sensorId: string,
    metadata: Record<string, unknown>
  ): Promise<{ endpointId: string; created: boolean }> {
    const method = typeof metadata.method === 'string' && metadata.method.length > 0
      ? metadata.method
      : 'UNKNOWN';
    const template = typeof metadata.template === 'string' && metadata.template.length > 0
      ? metadata.template
      : undefined;
    const path = typeof metadata.path === 'string' && metadata.path.length > 0
      ? metadata.path
      : undefined;
    const pathTemplate = template ?? path ?? 'unknown';
    const service = typeof metadata.service === 'string' && metadata.service.length > 0
      ? metadata.service
      : 'default';
    const schema = metadata.schema;
    const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
    const parameters = metadata.parameters;

    const existingEndpoint = await this.prisma.endpoint.findFirst({
      where: {
        tenantId,
        sensorId,
        method,
        pathTemplate,
      },
    });

    if (existingEndpoint) {
      const updated = await this.prisma.endpoint.update({
        where: { id: existingEndpoint.id },
        data: {
          lastSeenAt: new Date(),
          requestCount: { increment: 1 },
          hasSchema: schema ? true : undefined,
        },
      });

      return { endpointId: updated.id, created: false };
    }

    const created = await this.prisma.endpoint.create({
      data: {
        tenantId,
        sensorId,
        method,
        path: path ?? pathTemplate,
        pathTemplate,
        service,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        requestCount: 1,
        hasSchema: !!schema,
        requestSchema: schema ? (schema as Prisma.InputJsonValue) : undefined,
        metadata: {
          tags,
          parameters,
        },
      },
    });

    return { endpointId: created.id, created: true };
  }

  private async recordSchemaViolation(
    endpointId: string,
    tenantId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const field = typeof metadata.field === 'string' && metadata.field.length > 0
      ? metadata.field
      : 'unknown';

    await this.prisma.endpointSchemaChange.create({
      data: {
        endpointId,
        tenantId,
        changeType: 'violation',
        field,
        oldValue: this.coerceString(metadata.expectedType),
        newValue: this.coerceString(metadata.receivedType),
        riskLevel: 'medium',
        detectedAt: new Date(),
      },
    });
  }

  private coerceString(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  // ===========================================================================
  // Statistics & Analytics
  // ===========================================================================

  /**
   * Get discovery statistics for a tenant
   */
  async getDiscoveryStats(tenantId: string): Promise<DiscoveryStats> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all counts in parallel for performance
    const [
      totalEndpoints,
      newThisWeek,
      newToday,
      violations24h,
      violations7d,
      byMethod,
    ] = await Promise.all([
      // Total endpoints
      this.prisma.endpoint.count({
        where: { tenantId },
      }),

      // New this week
      this.prisma.endpoint.count({
        where: {
          tenantId,
          firstSeenAt: { gte: oneWeekAgo },
        },
      }),

      // New today
      this.prisma.endpoint.count({
        where: {
          tenantId,
          firstSeenAt: { gte: oneDayAgo },
        },
      }),

      // Violations in 24h
      this.prisma.signal.count({
        where: {
          tenantId,
          signalType: 'SCHEMA_VIOLATION',
          createdAt: { gte: oneDayAgo },
        },
      }),

      // Violations in 7d
      this.prisma.signal.count({
        where: {
          tenantId,
          signalType: 'SCHEMA_VIOLATION',
          createdAt: { gte: oneWeekAgo },
        },
      }),

      // Endpoints by method
      this.prisma.endpoint.groupBy({
        by: ['method'],
        where: { tenantId },
        _count: { id: true },
      }),
    ]);

    // Get top violating endpoints
    const topViolators = await this.getTopViolatingEndpoints(tenantId, oneWeekAgo);

    // Get discovery trend
    const discoveryTrend = await this.getDiscoveryTrend(tenantId, 7);

    return {
      totalEndpoints,
      newThisWeek,
      newToday,
      schemaViolations24h: violations24h,
      schemaViolations7d: violations7d,
      topViolatingEndpoints: topViolators,
      endpointsByMethod: Object.fromEntries(
        byMethod.map((m) => [m.method, m._count.id])
      ),
      discoveryTrend,
    };
  }

  /**
   * Get top violating endpoints
   */
  private async getTopViolatingEndpoints(
    tenantId: string,
    since: Date
  ): Promise<Array<{ endpoint: string; method: string; violationCount: number }>> {
    // Query signals grouped by endpoint path from metadata
    const violations = await this.prisma.signal.findMany({
      where: {
        tenantId,
        signalType: 'SCHEMA_VIOLATION',
        createdAt: { gte: since },
      },
      select: {
        metadata: true,
      },
    });

    // Aggregate violations by endpoint
    const endpointCounts = new Map<string, { method: string; count: number }>();

    for (const v of violations) {
      const meta = v.metadata as { endpoint?: string; method?: string } | null;
      if (meta?.endpoint) {
        const key = `${meta.method ?? 'GET'}:${meta.endpoint}`;
        const existing = endpointCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          endpointCounts.set(key, { method: meta.method ?? 'GET', count: 1 });
        }
      }
    }

    // Sort and return top 10
    return Array.from(endpointCounts.entries())
      .map(([key, value]) => ({
        endpoint: key.split(':').slice(1).join(':'),
        method: value.method,
        violationCount: value.count,
      }))
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 10);
  }

  /**
   * Get violation trends by day
   */
  async getViolationTrends(tenantId: string, days: number): Promise<ViolationTrend[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const violations = await this.prisma.signal.findMany({
      where: {
        tenantId,
        signalType: 'SCHEMA_VIOLATION',
        createdAt: { gte: since },
      },
      select: {
        createdAt: true,
        metadata: true,
      },
    });

    // Group by date and type
    const trendMap = new Map<string, Map<string, number>>();

    for (const v of violations) {
      const date = v.createdAt.toISOString().split('T')[0];
      const meta = v.metadata as { violationType?: string } | null;
      const type = meta?.violationType ?? 'unknown';

      if (!trendMap.has(date)) {
        trendMap.set(date, new Map());
      }
      const dateMap = trendMap.get(date)!;
      dateMap.set(type, (dateMap.get(type) ?? 0) + 1);
    }

    // Flatten to array
    const trends: ViolationTrend[] = [];
    for (const [date, types] of trendMap) {
      for (const [type, count] of types) {
        trends.push({ date, type, count });
      }
    }

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get discovery trend by day
   * Uses a single grouped query instead of N sequential queries (N+1 fix)
   */
  private async getDiscoveryTrend(
    tenantId: string,
    days: number
  ): Promise<Array<{ date: string; count: number }>> {
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Single query with groupBy instead of N sequential count queries
    const endpoints = await this.prisma.endpoint.findMany({
      where: {
        tenantId,
        firstSeenAt: { gte: since },
      },
      select: {
        firstSeenAt: true,
      },
    });

    // Aggregate counts by date in memory
    const countsByDate = new Map<string, number>();

    // Initialize all dates in range with 0
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      countsByDate.set(dateStr, 0);
    }

    // Count endpoints by date
    for (const endpoint of endpoints) {
      const dateStr = endpoint.firstSeenAt.toISOString().split('T')[0];
      if (countsByDate.has(dateStr)) {
        countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
      }
    }

    // Convert to sorted array
    return Array.from(countsByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ===========================================================================
  // Listing & Querying
  // ===========================================================================

  /**
   * List endpoints with pagination and filtering
   */
  async listEndpoints(
    tenantId: string,
    options: { limit?: number; offset?: number; method?: string }
  ): Promise<{ endpoints: unknown[]; total: number }> {
    const where = {
      tenantId,
      ...(options.method && { method: options.method }),
    };

    const [endpoints, total] = await Promise.all([
      this.prisma.endpoint.findMany({
        where,
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
        orderBy: { lastSeenAt: 'desc' },
      }),
      this.prisma.endpoint.count({ where }),
    ]);

    return { endpoints, total };
  }

  /**
   * List recent signals with pagination and filtering
   */
  async listSignals(
    tenantId: string,
    options: { limit?: number; offset?: number; type?: string; sensorId?: string }
  ): Promise<{ signals: unknown[]; total: number }> {
    const signalTypes: SignalType[] = ['TEMPLATE_DISCOVERY', 'SCHEMA_VIOLATION'];

    const where = {
      tenantId,
      signalType: options.type
        ? (options.type as SignalType)
        : { in: signalTypes },
      ...(options.sensorId && { sensorId: options.sensorId }),
    };

    const [signals, total] = await Promise.all([
      this.prisma.signal.findMany({
        where,
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.signal.count({ where }),
    ]);

    return { signals, total };
  }

  /**
   * Get a specific endpoint by ID
   */
  async getEndpoint(id: string, tenantId: string): Promise<unknown | null> {
    return this.prisma.endpoint.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Get endpoint by template pattern and method
   */
  async getEndpointByTemplate(
    tenantId: string,
    templatePattern: string,
    method: string
  ): Promise<unknown | null> {
    return this.prisma.endpoint.findFirst({
      where: {
        tenantId,
        pathTemplate: templatePattern,
        method,
      },
    });
  }
}
