import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import request from '../../../__tests__/test-request.js';
import { createPlaybookRoutes } from '../playbooks.js';
import { PlaybookService } from '../../../services/warroom/playbook-service.js';
import { SecurityAuditService } from '../../../services/audit/security-audit.js';

describe('Playbook Routes', () => {
  let app: Express;
  let prisma: PrismaClient;
  let logger: Logger;
  let playbookService: PlaybookService;
  let auditService: SecurityAuditService;

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      playbook: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      playbookRun: {
        findUnique: vi.fn(),
      }
    } as unknown as PrismaClient;

    logger = {
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown as Logger;

    playbookService = {
      listPlaybooks: vi.fn(),
      createPlaybook: vi.fn(),
      runPlaybook: vi.fn(),
      cancelPlaybookRun: vi.fn(),
      executeStep: vi.fn(),
    } as unknown as PlaybookService;

    auditService = {
      logPlaybookAccessDenied: vi.fn(),
      logPlaybookRunAccessDenied: vi.fn(),
      logPlaybookCreated: vi.fn(),
      logPlaybookUpdated: vi.fn(),
      logPlaybookDeleted: vi.fn(),
      logPlaybookExecutionStarted: vi.fn(),
      logPlaybookRunCancelled: vi.fn(),
    } as unknown as SecurityAuditService;

    const authMiddleware = (req: any, _res: any, next: any) => {
      req.auth = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        scopes: ['dashboard:read', 'dashboard:write'],
      };
      next();
    };

    app = express();
    app.use(express.json());
    // CRITICAL: Attach auth middleware to the app before the routes
    app.use(authMiddleware);
    app.use('/api/v1/playbooks', createPlaybookRoutes(prisma, logger, {
      playbookService,
      securityAuditService: auditService,
    }));
  });

  describe('Tenant Isolation', () => {
    const otherPlaybookId = '550e8400-e29b-41d4-a716-446655440001';

    it('returns 404 and logs audit when accessing playbook of another tenant', async () => {
      vi.mocked(prisma.playbook.findUnique).mockResolvedValue({
        id: otherPlaybookId,
        tenantId: 'tenant-wrong',
      } as any);

      await request(app)
        .get(`/api/v1/playbooks/${otherPlaybookId}`)
        .expect(404);

      expect(auditService.logPlaybookAccessDenied).toHaveBeenCalledWith(
        expect.any(Object),
        otherPlaybookId,
        'read'
      );
    });

    it('returns 404 and logs audit when updating playbook of another tenant', async () => {
      vi.mocked(prisma.playbook.findUnique).mockResolvedValue({
        id: otherPlaybookId,
        tenantId: 'tenant-wrong',
      } as any);

      await request(app)
        .patch(`/api/v1/playbooks/${otherPlaybookId}`)
        .send({ name: 'Hacked' })
        .expect(404);

      expect(auditService.logPlaybookAccessDenied).toHaveBeenCalledWith(
        expect.any(Object),
        otherPlaybookId,
        'update'
      );
    });

    it('returns 404 and logs audit when deleting playbook of another tenant', async () => {
      vi.mocked(prisma.playbook.findUnique).mockResolvedValue({
        id: otherPlaybookId,
        tenantId: 'tenant-wrong',
      } as any);

      await request(app)
        .delete(`/api/v1/playbooks/${otherPlaybookId}`)
        .expect(404);

      expect(auditService.logPlaybookAccessDenied).toHaveBeenCalledWith(
        expect.any(Object),
        otherPlaybookId,
        'delete'
      );
    });
  });

  describe('Step Validation (Zod)', () => {
    it('rejects command step missing commandType', async () => {
      const invalidPlaybook = {
        name: 'Invalid',
        triggerType: 'MANUAL',
        steps: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'command',
            title: 'No command type here',
            config: {
              // Missing commandType
              targetType: 'all'
            }
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/playbooks')
        .send(invalidPlaybook)
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('Command steps must specify a commandType');
    });

    it('accepts valid command step', async () => {
      const validPlaybook = {
        name: 'Valid',
        triggerType: 'MANUAL',
        steps: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'command',
            title: 'Valid Command',
            config: {
              commandType: 'push_rules',
              targetType: 'all'
            }
          }
        ]
      };

      vi.mocked(playbookService.createPlaybook).mockResolvedValue({ id: 'pb-1' } as any);

      await request(app)
        .post('/api/v1/playbooks')
        .send(validPlaybook)
        .expect(201);
    });
  });
});
