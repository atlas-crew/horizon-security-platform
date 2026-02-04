/**
 * Fleet Intel API Routes
 * Aggregated sensor intelligence from stored snapshots
 */

import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { z } from 'zod';
import { requireScope } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validation.js';
import { getErrorMessage } from '../../utils/errors.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

const ActorQuerySchema = PaginationSchema.extend({
  minRisk: z.coerce.number().min(0).max(100).optional(),
});

const SessionQuerySchema = PaginationSchema.extend({
  actorId: z.string().optional(),
  suspicious: z.preprocess(
    (val) => val === 'true' || val === '1',
    z.boolean().optional()
  ),
});

const CampaignQuerySchema = PaginationSchema.extend({
  status: z.string().optional(),
});

const ProfileQuerySchema = PaginationSchema.extend({
  template: z.string().optional(),
});

// =============================================================================
// Route Factory
// =============================================================================

export function createFleetIntelRoutes(prisma: PrismaClient, logger: Logger): Router {
  const router = Router();

  /**
   * GET /api/v1/fleet/intel/actors
   * List fleet actor snapshots
   */
  router.get(
    '/actors',
    requireScope('fleet:read'),
    validateQuery(ActorQuerySchema),
    async (req, res) => {
      try {
        const auth = req.auth!;
        const { limit, offset, minRisk } = req.query as z.infer<typeof ActorQuerySchema>;

        const where = {
          tenantId: auth.tenantId,
          ...(minRisk !== undefined ? { riskScore: { gte: minRisk } } : {}),
        };

        const [actors, total] = await Promise.all([
          prisma.sensorIntelActor.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { lastSeenAt: 'desc' },
          }),
          prisma.sensorIntelActor.count({ where }),
        ]);

        res.json({
          actors,
          pagination: { total, limit, offset },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to list fleet actors');
        res.status(500).json({
          error: 'Failed to list fleet actors',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/fleet/intel/sessions
   * List fleet session snapshots
   */
  router.get(
    '/sessions',
    requireScope('fleet:read'),
    validateQuery(SessionQuerySchema),
    async (req, res) => {
      try {
        const auth = req.auth!;
        const { limit, offset, actorId, suspicious } = req.query as z.infer<typeof SessionQuerySchema>;

        const where = {
          tenantId: auth.tenantId,
          ...(actorId ? { actorId } : {}),
          ...(suspicious !== undefined ? { isSuspicious: suspicious } : {}),
        };

        const [sessions, total] = await Promise.all([
          prisma.sensorIntelSession.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { lastActivityAt: 'desc' },
          }),
          prisma.sensorIntelSession.count({ where }),
        ]);

        res.json({
          sessions,
          pagination: { total, limit, offset },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to list fleet sessions');
        res.status(500).json({
          error: 'Failed to list fleet sessions',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/fleet/intel/campaigns
   * List fleet campaign snapshots
   */
  router.get(
    '/campaigns',
    requireScope('fleet:read'),
    validateQuery(CampaignQuerySchema),
    async (req, res) => {
      try {
        const auth = req.auth!;
        const { limit, offset, status } = req.query as z.infer<typeof CampaignQuerySchema>;

        const where = {
          tenantId: auth.tenantId,
          ...(status ? { status } : {}),
        };

        const [campaigns, total] = await Promise.all([
          prisma.sensorIntelCampaign.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { lastActivityAt: 'desc' },
          }),
          prisma.sensorIntelCampaign.count({ where }),
        ]);

        res.json({
          campaigns,
          pagination: { total, limit, offset },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to list fleet campaigns');
        res.status(500).json({
          error: 'Failed to list fleet campaigns',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/fleet/intel/profiles
   * List fleet profile snapshots
   */
  router.get(
    '/profiles',
    requireScope('fleet:read'),
    validateQuery(ProfileQuerySchema),
    async (req, res) => {
      try {
        const auth = req.auth!;
        const { limit, offset, template } = req.query as z.infer<typeof ProfileQuerySchema>;

        const where = {
          tenantId: auth.tenantId,
          ...(template ? { template } : {}),
        };

        const [profiles, total] = await Promise.all([
          prisma.sensorIntelProfile.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { updatedAt: 'desc' },
          }),
          prisma.sensorIntelProfile.count({ where }),
        ]);

        res.json({
          profiles,
          pagination: { total, limit, offset },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to list fleet profiles');
        res.status(500).json({
          error: 'Failed to list fleet profiles',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/fleet/intel/payload/stats
   * Get latest payload snapshot (fleet-wide)
   */
  router.get(
    '/payload/stats',
    requireScope('fleet:read'),
    async (req, res) => {
      try {
        const auth = req.auth!;

        const snapshot = await prisma.sensorPayloadSnapshot.findFirst({
          where: { tenantId: auth.tenantId },
          orderBy: { capturedAt: 'desc' },
        });

        res.json({ snapshot: snapshot ?? null });
      } catch (error) {
        logger.error({ error }, 'Failed to get fleet payload stats');
        res.status(500).json({
          error: 'Failed to get fleet payload stats',
          message: getErrorMessage(error),
        });
      }
    }
  );

  return router;
}
