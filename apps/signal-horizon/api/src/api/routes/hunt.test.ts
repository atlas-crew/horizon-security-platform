/**
 * Hunt Routes Integration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from '../../__tests__/test-request.js';
import { createHuntRoutes } from './hunt.js';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { HuntQuery, HuntResult, HuntService, SavedQuery, HourlyStats } from '../../services/hunt/index.js';

vi.mock('../../middleware/index.js', () => ({
  rateLimiters: {
    hunt: (_req: Request, _res: Response, next: NextFunction) => next(),
    aggregations: (_req: Request, _res: Response, next: NextFunction) => next(),
    savedQueries: (_req: Request, _res: Response, next: NextFunction) => next(),
  },
}));

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

const injectAuth = (tenantId: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.auth = { tenantId, scopes: ['hunt:read', 'hunt:execute'] } as unknown as typeof req.auth;
    next();
  };
};

describe('Hunt Routes', () => {
  let app: Express;
  let huntService: HuntService;

  beforeEach(() => {
    huntService = {
      isHistoricalEnabled: vi.fn().mockReturnValue(true),
      queryTimeline: vi.fn(),
      getCampaignTimeline: vi.fn(),
      getRequestTimeline: vi.fn(),
      getRecentRequests: vi.fn(),
      getHourlyStats: vi.fn(),
      getIpActivity: vi.fn(),
      getLowAndSlowIps: vi.fn(),
      getFleetFingerprintIntelligence: vi.fn(),
      getSavedQueries: vi.fn(),
      saveQuery: vi.fn(),
      getSavedQuery: vi.fn(),
      deleteSavedQuery: vi.fn(),
      getTenantBaselines: vi.fn(),
      getAnomalies: vi.fn(),
    } as unknown as HuntService;

    app = express();
    app.use(express.json());
    app.use(injectAuth('tenant-1'));
    app.use('/api/v1/hunt', createHuntRoutes({} as PrismaClient, mockLogger, huntService));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/v1/hunt/query enforces tenant isolation', async () => {
    const result: HuntResult = {
      signals: [],
      total: 0,
      source: 'postgres',
      queryTimeMs: 12,
    };

    vi.mocked(huntService.queryTimeline).mockResolvedValue(result);

    const startTime = new Date(Date.now() - 60_000).toISOString();
    const endTime = new Date().toISOString();

    const response = await request(app)
      .post('/api/v1/hunt/query')
      .send({
        tenantId: 'tenant-2',
        startTime,
        endTime,
        limit: 5,
        offset: 0,
      })
      .expect(200);

    const calledWith = vi.mocked(huntService.queryTimeline).mock.calls[0][0] as HuntQuery;
    expect(calledWith.tenantId).toBe('tenant-1');
    expect(response.body).toMatchObject({
      success: true,
      data: [],
      meta: {
        total: 0,
        source: 'postgres',
        limit: 5,
        offset: 0,
      },
    });
  });

  it('GET /api/v1/hunt/stats/hourly uses authenticated tenant', async () => {
    const stats: HourlyStats[] = [
      {
        hour: new Date(),
        tenantId: 'tenant-1',
        signalType: 'IP_THREAT',
        severity: 'HIGH',
        signalCount: 3,
        totalEvents: 3,
        uniqueIps: 2,
        uniqueFingerprints: 1,
      },
    ];

    vi.mocked(huntService.getHourlyStats).mockResolvedValue(stats);

    const startTime = new Date(Date.now() - 3600_000).toISOString();
    const endTime = new Date().toISOString();

    const query = new URLSearchParams({
      tenantId: 'tenant-2',
      startTime,
      endTime,
    }).toString();

    const response = await request(app)
      .get(`/api/v1/hunt/stats/hourly?${query}`)
      .expect(200);

    expect(vi.mocked(huntService.getHourlyStats)).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Date),
      expect.any(Date),
      undefined
    );
    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Array),
      meta: { count: 1 },
    });
  });

  it('GET /api/v1/hunt/baselines uses authenticated tenant', async () => {
    vi.mocked(huntService.getTenantBaselines).mockResolvedValue([]);

    const response = await request(app)
      .get('/api/v1/hunt/baselines?days=45')
      .expect(200);

    expect(vi.mocked(huntService.getTenantBaselines)).toHaveBeenCalledWith('tenant-1', 45);
    expect(response.body).toMatchObject({
      success: true,
      data: [],
      meta: { tenantId: 'tenant-1', lookbackDays: 45, historical: true },
    });
  });

  it('GET /api/v1/hunt/baselines returns graceful empty response when ClickHouse disabled', async () => {
    vi.mocked(huntService.isHistoricalEnabled).mockReturnValue(false);

    const response = await request(app)
      .get('/api/v1/hunt/baselines')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: [],
      meta: { historical: false },
    });
  });

  it('GET /api/v1/hunt/anomalies uses authenticated tenant', async () => {
    vi.mocked(huntService.getAnomalies).mockResolvedValue([]);

    const response = await request(app)
      .get('/api/v1/hunt/anomalies?zScore=3.5')
      .expect(200);

    expect(vi.mocked(huntService.getAnomalies)).toHaveBeenCalledWith('tenant-1', 3.5);
    expect(response.body).toMatchObject({
      success: true,
      data: [],
      meta: { tenantId: 'tenant-1', zScoreThreshold: 3.5, historical: true },
    });
  });

  it('GET /api/v1/hunt/anomalies returns graceful empty response when ClickHouse disabled', async () => {
    vi.mocked(huntService.isHistoricalEnabled).mockReturnValue(false);

    const response = await request(app)
      .get('/api/v1/hunt/anomalies')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: [],
      meta: { historical: false },
    });
  });

  it('GET /api/v1/hunt/anomalies rejects invalid zScore', async () => {
    const response = await request(app)
      .get('/api/v1/hunt/anomalies?zScore=100')
      .expect(400);

    expect(response.body).toMatchObject({ error: 'Invalid query parameters' });
  });

  it('GET /api/v1/hunt/low-and-slow requires admin role', async () => {
    const response = await request(app)
      .get('/api/v1/hunt/low-and-slow')
      .expect(403);

    expect(response.body).toMatchObject({
      title: 'Forbidden',
      detail: expect.stringContaining('Requires admin role'),
      code: 'INSUFFICIENT_ROLE',
    });
  });

  it('GET /api/v1/hunt/low-and-slow returns candidates for admin', async () => {
    const adminApp = express();
    adminApp.use(express.json());
    adminApp.use((req: Request, _res: Response, next: NextFunction) => {
      req.auth = {
        tenantId: 'tenant-1',
        scopes: ['hunt:read', 'fleet:admin'],
        isFleetAdmin: true,
      } as unknown as typeof req.auth;
      next();
    });
    adminApp.use('/api/v1/hunt', createHuntRoutes({} as PrismaClient, mockLogger, huntService));

    vi.mocked(huntService.getLowAndSlowIps).mockResolvedValue([
      { sourceIp: '203.0.113.10', daysSeen: 12, maxDailySignals: 7, totalSignals: 40, tenantsHit: 3 },
    ]);

    const response = await request(adminApp)
      .get('/api/v1/hunt/low-and-slow?days=90&minDistinctDays=5&maxSignalsPerDay=10&limit=25')
      .expect(200);

    expect(vi.mocked(huntService.getLowAndSlowIps)).toHaveBeenCalledWith({
      days: 90,
      minDistinctDays: 5,
      maxSignalsPerDay: 10,
      limit: 25,
    });
    expect(response.body).toMatchObject({
      success: true,
      data: [{ sourceIp: '203.0.113.10' }],
      meta: { days: 90, minDistinctDays: 5, maxSignalsPerDay: 10, limit: 25, historical: true, count: 1 },
    });
  });

  it('GET /api/v1/hunt/fleet-intel/fingerprints requires admin role', async () => {
    const response = await request(app)
      .get('/api/v1/hunt/fleet-intel/fingerprints')
      .expect(403);

    expect(response.body).toMatchObject({
      title: 'Forbidden',
      detail: expect.stringContaining('Requires admin role'),
      code: 'INSUFFICIENT_ROLE',
    });
  });

  it('GET /api/v1/hunt/fleet-intel/fingerprints returns candidates for admin', async () => {
    const adminApp = express();
    adminApp.use(express.json());
    adminApp.use((req: Request, _res: Response, next: NextFunction) => {
      req.auth = {
        tenantId: 'tenant-1',
        scopes: ['hunt:read', 'fleet:admin'],
        isFleetAdmin: true,
      } as unknown as typeof req.auth;
      next();
    });
    adminApp.use('/api/v1/hunt', createHuntRoutes({} as PrismaClient, mockLogger, huntService));

    vi.mocked(huntService.getFleetFingerprintIntelligence).mockResolvedValue([
      {
        anonFingerprint: 'a'.repeat(64),
        tenantsHit: 4,
        sensorsHit: 9,
        totalSignals: 120,
        firstSeen: new Date('2025-01-01T00:00:00.000Z'),
        lastSeen: new Date('2025-01-02T00:00:00.000Z'),
        signalTypes: ['IP_THREAT'],
        tenantIds: ['tenant-a', 'tenant-b'],
        sensorIds: ['sensor-1'],
      },
    ] as never);

    const response = await request(adminApp)
      .get('/api/v1/hunt/fleet-intel/fingerprints?days=30&minTenants=3&minSensors=5&limit=25')
      .expect(200);

    expect(vi.mocked(huntService.getFleetFingerprintIntelligence)).toHaveBeenCalledWith({
      days: 30,
      minTenants: 3,
      minSensors: 5,
      limit: 25,
    });
    expect(response.body).toMatchObject({
      success: true,
      data: [{ anonFingerprint: 'a'.repeat(64) }],
      meta: { days: 30, minTenants: 3, minSensors: 5, limit: 25, historical: true, count: 1 },
    });
  });

  it('GET /api/v1/hunt/request/:requestId enforces tenant isolation', async () => {
    vi.mocked(huntService.getRequestTimeline).mockResolvedValue([]);

    const response = await request(app)
      .get('/api/v1/hunt/request/req_123')
      .expect(200);

    expect(vi.mocked(huntService.getRequestTimeline)).toHaveBeenCalledWith(
      'tenant-1',
      'req_123',
      undefined,
      undefined,
      undefined
    );
    expect(response.body).toMatchObject({
      success: true,
      data: [],
      meta: {
        requestId: 'req_123',
        tenantId: 'tenant-1',
        count: 0,
      },
    });
  });

  it('GET /api/v1/hunt/request/:requestId returns 503 when ClickHouse disabled', async () => {
    vi.mocked(huntService.isHistoricalEnabled).mockReturnValue(false);

    const response = await request(app)
      .get('/api/v1/hunt/request/req_123')
      .expect(503);

    expect(response.body).toMatchObject({
      error: 'Historical queries not available',
    });
    expect(huntService.getRequestTimeline).not.toHaveBeenCalled();
  });

  it('GET /api/v1/hunt/requests/recent uses authenticated tenant', async () => {
    vi.mocked(huntService.getRecentRequests).mockResolvedValue([
      {
        requestId: 'req_123',
        lastSeenAt: new Date(),
        sensorId: 'sensor-1',
        path: '/',
        statusCode: 200,
        wafAction: 'allow',
      },
    ] as never);

    const response = await request(app)
      .get('/api/v1/hunt/requests/recent')
      .expect(200);

    expect(vi.mocked(huntService.getRecentRequests)).toHaveBeenCalledWith('tenant-1', 25);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Array),
      meta: {
        tenantId: 'tenant-1',
        count: 1,
        limit: 25,
      },
    });
  });

  it('GET /api/v1/hunt/requests/recent returns empty list when ClickHouse disabled', async () => {
    vi.mocked(huntService.isHistoricalEnabled).mockReturnValue(false);

    const response = await request(app)
      .get('/api/v1/hunt/requests/recent')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: [],
      meta: {
        tenantId: 'tenant-1',
        count: 0,
        limit: 25,
        historical: false,
      },
    });
    expect(huntService.getRecentRequests).not.toHaveBeenCalled();
  });

  it('POST /api/v1/hunt/saved-queries/:id/run overrides saved tenant', async () => {
    const savedQuery: SavedQuery = {
      id: 'query-1',
      name: 'Test Query',
      createdBy: 'user-1',
      createdAt: new Date(),
      query: {
        tenantId: 'tenant-2',
        startTime: new Date(Date.now() - 60_000),
        endTime: new Date(),
        limit: 10,
        offset: 0,
      },
    };

    const result: HuntResult = {
      signals: [],
      total: 0,
      source: 'postgres',
      queryTimeMs: 9,
    };

    vi.mocked(huntService.getSavedQuery).mockResolvedValue(savedQuery);
    vi.mocked(huntService.queryTimeline).mockResolvedValue(result);

    await request(app)
      .post('/api/v1/hunt/saved-queries/query-1/run')
      .expect(200);

    const calledWith = vi.mocked(huntService.queryTimeline).mock.calls[0][0] as HuntQuery;
    expect(calledWith.tenantId).toBe('tenant-1');
  });

  describe('Hunt query validation', () => {
    const buildBaseQuery = () => {
      const startTime = new Date(Date.now() - 60_000).toISOString();
      const endTime = new Date().toISOString();

      return { startTime, endTime, limit: 5, offset: 0 };
    };

    it('rejects SQL injection attempts in time parameters', async () => {
      const baseQuery = buildBaseQuery();

      const response = await request(app)
        .post('/api/v1/hunt/query')
        .send({
          ...baseQuery,
          startTime: `${baseQuery.startTime}' OR 1=1 --`,
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'Invalid query parameters' });
      expect(huntService.queryTimeline).not.toHaveBeenCalled();
    });

    it('rejects time-based blind injection payloads', async () => {
      const baseQuery = buildBaseQuery();

      const response = await request(app)
        .post('/api/v1/hunt/query')
        .send({
          ...baseQuery,
          endTime: `${baseQuery.endTime}; SELECT pg_sleep(5)`,
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'Invalid query parameters' });
      expect(huntService.queryTimeline).not.toHaveBeenCalled();
    });

    it('rejects NoSQL injection in filter parameters', async () => {
      const baseQuery = buildBaseQuery();

      const response = await request(app)
        .post('/api/v1/hunt/query')
        .send({
          ...baseQuery,
          sourceIps: [{ $ne: '198.51.100.10' }],
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'Invalid query parameters' });
      expect(huntService.queryTimeline).not.toHaveBeenCalled();
    });

    it('enforces pagination limit bounds', async () => {
      const baseQuery = buildBaseQuery();

      const response = await request(app)
        .post('/api/v1/hunt/query')
        .send({
          ...baseQuery,
          limit: 10001,
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'Invalid query parameters' });
      expect(huntService.queryTimeline).not.toHaveBeenCalled();
    });

    it('rejects invalid input shapes', async () => {
      const baseQuery = buildBaseQuery();

      const response = await request(app)
        .post('/api/v1/hunt/query')
        .send({
          ...baseQuery,
          anonFingerprint: 'abc123',
        })
        .expect(400);

      expect(response.body).toMatchObject({ error: 'Invalid query parameters' });
      expect(huntService.queryTimeline).not.toHaveBeenCalled();
    });
  });
});
