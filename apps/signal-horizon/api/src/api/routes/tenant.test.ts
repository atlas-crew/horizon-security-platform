/**
 * Tenant Settings API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from '../../__tests__/test-request.js';
import express from 'express';
import { createTenantRoutes } from './tenant.js';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { SecurityAuditService } from '../../services/audit/security-audit.js';

// Mock Prisma
const mockPrisma = {
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  idempotencyRequest: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  signal: {
    updateMany: vi.fn(),
  },
  blocklistEntry: {
    updateMany: vi.fn(),
  },
  $executeRaw: vi.fn().mockResolvedValue(1),
  $transaction: vi.fn(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma)),
} as unknown as PrismaClient;

// Mock Logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

// Mock Security Audit
const mockSecurityAudit = {
  record: vi.fn().mockResolvedValue(undefined),
} as unknown as SecurityAuditService;

describe('Tenant Settings API', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.auth = { tenantId: 'tenant-123', userId: 'user-123', scopes: ['fleet:read', 'fleet:write'] };
      next();
    });

    app.use('/tenant', createTenantRoutes(mockPrisma, mockLogger, mockSecurityAudit));
  });

  describe('GET /tenant/settings', () => {
    it('should return tenant settings', async () => {
      vi.mocked(mockPrisma.tenant.findUnique).mockResolvedValue({
        id: 'tenant-123',
        name: 'Test Tenant',
        tier: 'STANDARD',
        sharingPreference: 'CONTRIBUTE_AND_RECEIVE',
        preferenceVersion: 1,
        preferenceChangedBy: null,
        preferenceChangedAt: null,
        updatedAt: new Date(),
        consents: [],
      } as never);

      const response = await request(app).get('/tenant/settings');

      expect(response.status).toBe(200);
      expect(response.body.data.sharingPreference).toBe('CONTRIBUTE_AND_RECEIVE');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tenant-123' } })
      );
    });

    it('should return 404 if tenant not found', async () => {
      vi.mocked(mockPrisma.tenant.findUnique).mockResolvedValue(null as never);

      const response = await request(app).get('/tenant/settings');

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /tenant/settings', () => {
    it('should update sharing preference and log audit', async () => {
      vi.mocked(mockPrisma.tenant.findUnique).mockResolvedValue({
        id: 'tenant-123',
        sharingPreference: 'CONTRIBUTE_AND_RECEIVE',
        consents: [{ id: 'consent-1', consentType: 'BLOCKLIST_SHARING', acknowledged: true, grantedAt: new Date() }],
      } as never);

      vi.mocked(mockPrisma.tenant.update).mockResolvedValue({
        id: 'tenant-123',
        sharingPreference: 'CONTRIBUTE_ONLY', // Same contribution level
      } as never);

      const response = await request(app)
        .patch('/tenant/settings')
        .set('Idempotency-Key', 'idempotency-key-1')
        .send({ sharingPreference: 'CONTRIBUTE_ONLY' });

      expect(response.status).toBe(200);
      expect(mockPrisma.tenant.update).toHaveBeenCalled();
      
      // Verify audit log for change
      expect(mockSecurityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TENANT_SETTINGS_UPDATE',
          resourceType: 'tenant',
          resourceId: 'tenant-123',
          details: expect.objectContaining({
            change: 'sharingPreference',
            from: 'CONTRIBUTE_AND_RECEIVE',
            to: 'CONTRIBUTE_ONLY',
          }),
        })
      );

      // Verify NO data withdrawal triggered (both are contributing)
      expect(mockPrisma.signal.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.blocklistEntry.updateMany).not.toHaveBeenCalled();
    });

    it('should return 404 if tenant not found', async () => {
      vi.mocked(mockPrisma.tenant.findUnique).mockResolvedValue(null as never);

      const response = await request(app)
        .patch('/tenant/settings')
        .set('Idempotency-Key', 'idempotency-key-404')
        .send({ sharingPreference: 'ISOLATED' });

      expect(response.status).toBe(404);
      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });

    it('should trigger data withdrawal on downgrade to ISOLATED', async () => {
      vi.mocked(mockPrisma.tenant.findUnique).mockResolvedValue({
        id: 'tenant-123',
        sharingPreference: 'CONTRIBUTE_AND_RECEIVE',
        consents: [],
      } as never);

      vi.mocked(mockPrisma.tenant.update).mockResolvedValue({
        id: 'tenant-123',
        sharingPreference: 'ISOLATED',
      } as never);

      vi.mocked(mockPrisma.signal.updateMany).mockResolvedValue({ count: 50 } as never);
      vi.mocked(mockPrisma.blocklistEntry.updateMany).mockResolvedValue({ count: 10 } as never);

      const response = await request(app)
        .patch('/tenant/settings')
        .set('Idempotency-Key', 'idempotency-key-2')
        .send({ sharingPreference: 'ISOLATED' });

      expect(response.status).toBe(200);

      // Verify signal scrubbing
      expect(mockPrisma.signal.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        data: { anonFingerprint: null },
      });

      // Verify blocklist withdrawal
      expect(mockPrisma.blocklistEntry.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        data: {
          propagationStatus: 'WITHDRAWN',
          withdrawnAt: expect.any(Date),
        },
      });

      // Verify audit log for withdrawal
      expect(mockSecurityAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DATA_WITHDRAWAL',
          resourceType: 'tenant',
          resourceId: 'tenant-123',
          details: expect.objectContaining({
            signalsScrubbed: 50,
            blocksWithdrawn: 10,
          }),
        })
      );
    });

    it('should validate sharing preference values', async () => {
      const response = await request(app)
        .patch('/tenant/settings')
        .set('Idempotency-Key', 'idempotency-key-3')
        .send({ sharingPreference: 'INVALID_VALUE' });

      expect(response.status).toBe(400);
      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });
  });
});
