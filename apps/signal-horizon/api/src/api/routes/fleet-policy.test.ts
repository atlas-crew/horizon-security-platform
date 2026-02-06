/**
 * Fleet Policy Routes Test Suite
 *
 * Tests for tenant isolation on policy endpoints.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import request from '../../__tests__/test-request.js';
import { createFleetPolicyRoutes } from './fleet-policy.js';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { PolicyTemplateService } from '../../services/fleet/policy-template.js';

vi.mock('../middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/auth.js')>();
  return {
    ...actual,
    requireScope: (scope: string) => (req: Request, _res: Response, next: NextFunction) => {
      if (req.auth?.scopes?.includes(scope)) {
        return next();
      }
      _res.status(403).json({ error: 'Forbidden' });
    },
  };
});

vi.mock('../middleware/validation.js', () => ({
  validateParams: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  validateBody: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  IdParamSchema: {},
}));

const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

const injectAuth = (tenantId: string, scopes: string[] = ['policy:read', 'policy:write']) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.auth = { tenantId, scopes } as unknown as typeof req.auth;
    next();
  };
};

const buildPolicyService = (): PolicyTemplateService => ({
  listTemplates: vi.fn(),
  getDefaultTemplates: vi.fn(),
  getTemplate: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  applyTemplate: vi.fn(),
  cloneTemplate: vi.fn(),
  getDefaultConfigBySeverity: vi.fn(),
} as unknown as PolicyTemplateService);

describe('Fleet Policy Routes', () => {
  let app: Express;
  let mockPrisma: Partial<PrismaClient>;
  let policyService: PolicyTemplateService;

  beforeEach(() => {
    mockPrisma = {
      policyTemplate: {
        findUnique: vi.fn(),
      } as unknown as PrismaClient['policyTemplate'],
    };

    policyService = buildPolicyService();

    app = express();
    app.use(express.json());
    app.use(injectAuth('tenant-1', ['policy:read', 'policy:write']));
    app.use(
      '/fleet/policies',
      createFleetPolicyRoutes(mockPrisma as PrismaClient, mockLogger, { policyService })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tenant Isolation', () => {
    const setCrossTenantPolicy = () => {
      vi.mocked(mockPrisma.policyTemplate!.findUnique).mockResolvedValue({
        tenantId: 'other-tenant',
      } as { tenantId: string });
    };

    it('blocks GET /fleet/policies/:id for other tenant', async () => {
      setCrossTenantPolicy();

      await request(app)
        .get('/fleet/policies/policy-1')
        .expect(403);

      expect(policyService.getTemplate).not.toHaveBeenCalled();
    });

    it('blocks PUT /fleet/policies/:id for other tenant', async () => {
      setCrossTenantPolicy();

      await request(app)
        .put('/fleet/policies/policy-1')
        .send({ name: 'Updated' })
        .expect(403);

      expect(policyService.updateTemplate).not.toHaveBeenCalled();
    });

    it('blocks DELETE /fleet/policies/:id for other tenant', async () => {
      setCrossTenantPolicy();

      await request(app)
        .delete('/fleet/policies/policy-1')
        .expect(403);

      expect(policyService.deleteTemplate).not.toHaveBeenCalled();
    });

    it('blocks POST /fleet/policies/:id/apply for other tenant', async () => {
      setCrossTenantPolicy();

      await request(app)
        .post('/fleet/policies/policy-1/apply')
        .send({ sensorIds: ['sensor-1'] })
        .expect(403);

      expect(policyService.applyTemplate).not.toHaveBeenCalled();
    });

    it('blocks POST /fleet/policies/:id/clone for other tenant', async () => {
      setCrossTenantPolicy();

      await request(app)
        .post('/fleet/policies/policy-1/clone')
        .send({ name: 'Clone' })
        .expect(403);

      expect(policyService.cloneTemplate).not.toHaveBeenCalled();
    });
  });
});
