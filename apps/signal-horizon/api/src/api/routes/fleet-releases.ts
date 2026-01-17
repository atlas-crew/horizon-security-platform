/**
 * Fleet Releases API Routes
 *
 * Endpoints for firmware/release management for Synapse-Pingora sensors.
 * Handles release creation, rollout orchestration, and update progress tracking.
 */

import { Router } from 'express';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { Logger } from 'pino';
import { z } from 'zod';
import { requireScope } from '../middleware/auth.js';
import {
  validateParams,
  validateQuery,
  validateBody,
} from '../middleware/validation.js';
import { getErrorMessage } from '../../utils/errors.js';
import type { TunnelBroker } from '../../websocket/tunnel-broker.js';
import { RolloutOrchestrator } from '../../services/fleet/rollout-orchestrator.js';
import type { FleetCommander } from '../../services/fleet/fleet-commander.js';

// ======================== Validation Schemas ========================

const ListReleasesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['version', 'createdAt', 'size']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const CreateReleaseBodySchema = z.object({
  version: z
    .string()
    .min(1)
    .max(50)
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, 'Must be valid semver'),
  changelog: z.string().min(1).max(10000),
  binaryUrl: z.string().url(),
  sha256: z.string().length(64).regex(/^[a-fA-F0-9]+$/, 'Must be hex string'),
  size: z.coerce.number().int().min(1).max(500 * 1024 * 1024), // Max 500MB
});

const ReleaseIdParamSchema = z.object({
  id: z.string().min(1),
});

const RolloutIdParamSchema = z.object({
  id: z.string().min(1),
});

/** Rollout strategy types */
const ROLLOUT_STRATEGIES = ['immediate', 'canary', 'rolling'] as const;

const StartRolloutBodySchema = z.object({
  strategy: z.enum(ROLLOUT_STRATEGIES).default('immediate'),
  targetTags: z.string().array().optional(),
  sensorIds: z.string().array().optional(),
  batchSize: z.coerce.number().int().min(1).max(100).default(10),
  batchDelay: z.coerce.number().int().min(0).max(3600).default(60),
});

const ListRolloutsQuerySchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled'])
    .optional(),
  releaseId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ======================== Types ========================

/** Release status */
type ReleaseWithRollouts = {
  id: string;
  version: string;
  changelog: string;
  binaryUrl: string;
  sha256: string;
  size: number;
  createdAt: Date;
  createdBy: string;
  rollouts: Array<{
    id: string;
    status: string;
    startedAt: Date | null;
  }>;
};

/** Rollout progress summary */
interface RolloutSummary {
  total: number;
  pending: number;
  downloading: number;
  ready: number;
  activated: number;
  failed: number;
}

/** Rollout with progress from Prisma */
interface RolloutWithProgress {
  id: string;
  strategy: string;
  status: string;
  targetTags: string[];
  batchSize: number;
  batchDelay: number;
  startedAt: Date | null;
  completedAt: Date | null;
  progress: Array<{ status: string }>;
}

/** Progress entry */
interface ProgressEntry {
  id: string;
  status: string;
  error: string | null;
  updatedAt: Date;
  sensorId: string;
}

/** Rollout list item from Prisma query */
interface RolloutListItem {
  id: string;
  releaseId: string;
  strategy: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  release: { version: string };
  _count: { progress: number };
}

// ======================== Route Handler ========================

export interface FleetReleasesOptions {
  tunnelBroker?: TunnelBroker;
  fleetCommander?: FleetCommander;
}

export function createFleetReleasesRoutes(
  prisma: PrismaClient,
  logger: Logger,
  options: FleetReleasesOptions = {}
): Router {
  const router = Router();
  const { fleetCommander } = options;
  const orchestrator = new RolloutOrchestrator(prisma, logger, fleetCommander);

  // ======================== Release Management ========================

  /**
   * GET /api/v1/releases
   * List all releases with pagination
   */
  router.get(
    '/',
    requireScope('releases:read'),
    validateQuery(ListReleasesQuerySchema),
    async (req, res) => {
      try {
        const { limit, offset, sort, sortDir } = req.query as unknown as z.infer<
          typeof ListReleasesQuerySchema
        >;

        const orderBy: Record<string, 'asc' | 'desc'> = {};
        orderBy[sort] = sortDir;

        const [releases, total] = await Promise.all([
          prisma.release.findMany({
            take: limit,
            skip: offset,
            orderBy,
            include: {
              rollouts: {
                select: {
                  id: true,
                  status: true,
                  startedAt: true,
                },
                orderBy: { startedAt: 'desc' },
                take: 1,
              },
            },
          }),
          prisma.release.count(),
        ]);

        // Transform releases with deployment info
        const releasesWithStats = releases.map((release: ReleaseWithRollouts) => {
          const latestRollout = release.rollouts[0];
          return {
            id: release.id,
            version: release.version,
            changelog: release.changelog,
            binaryUrl: release.binaryUrl,
            sha256: release.sha256,
            size: release.size,
            createdAt: release.createdAt,
            createdBy: release.createdBy,
            latestRollout: latestRollout
              ? {
                  id: latestRollout.id,
                  status: latestRollout.status,
                  startedAt: latestRollout.startedAt,
                }
              : null,
          };
        });

        res.json({
          releases: releasesWithStats,
          pagination: { total, limit, offset },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to list releases');
        res.status(500).json({
          error: 'Failed to list releases',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * POST /api/v1/releases
   * Create a new release
   */
  router.post(
    '/',
    requireScope('releases:write'),
    validateBody(CreateReleaseBodySchema),
    async (req, res) => {
      try {
        const { version, changelog, binaryUrl, sha256, size } =
          req.body as z.infer<typeof CreateReleaseBodySchema>;
        const auth = req.auth!;

        // Check for duplicate version
        const existing = await prisma.release.findUnique({
          where: { version },
        });

        if (existing) {
          res.status(409).json({
            error: 'Release version already exists',
            existingId: existing.id,
          });
          return;
        }

        const release = await prisma.release.create({
          data: {
            version,
            changelog,
            binaryUrl,
            sha256,
            size,
            createdBy: auth.userId || auth.tenantId,
          },
        });

        logger.info(
          { releaseId: release.id, version },
          'Release created'
        );

        res.status(201).json(release);
      } catch (error) {
        logger.error({ error }, 'Failed to create release');
        res.status(500).json({
          error: 'Failed to create release',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/releases/:id
   * Get release details including rollout history
   */
  router.get(
    '/:id',
    requireScope('releases:read'),
    validateParams(ReleaseIdParamSchema),
    async (req, res) => {
      try {
        const { id } = req.params;

        const release = await prisma.release.findUnique({
          where: { id },
          include: {
            rollouts: {
              orderBy: { startedAt: 'desc' },
              include: {
                progress: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          },
        });

        if (!release) {
          res.status(404).json({ error: 'Release not found' });
          return;
        }

        // Calculate rollout statistics
        const rolloutsWithStats = release.rollouts.map((rollout: RolloutWithProgress) => {
          const summary: RolloutSummary = {
            total: rollout.progress.length,
            pending: 0,
            downloading: 0,
            ready: 0,
            activated: 0,
            failed: 0,
          };

          for (const p of rollout.progress) {
            switch (p.status) {
              case 'pending':
                summary.pending++;
                break;
              case 'downloading':
                summary.downloading++;
                break;
              case 'ready':
                summary.ready++;
                break;
              case 'activated':
                summary.activated++;
                break;
              case 'failed':
                summary.failed++;
                break;
            }
          }

          return {
            id: rollout.id,
            strategy: rollout.strategy,
            status: rollout.status,
            targetTags: rollout.targetTags,
            batchSize: rollout.batchSize,
            batchDelay: rollout.batchDelay,
            startedAt: rollout.startedAt,
            completedAt: rollout.completedAt,
            summary,
          };
        });

        res.json({
          id: release.id,
          version: release.version,
          changelog: release.changelog,
          binaryUrl: release.binaryUrl,
          sha256: release.sha256,
          size: release.size,
          createdAt: release.createdAt,
          createdBy: release.createdBy,
          rollouts: rolloutsWithStats,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get release details');
        res.status(500).json({
          error: 'Failed to get release details',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * DELETE /api/v1/releases/:id
   * Delete a release (only if no active rollouts)
   */
  router.delete(
    '/:id',
    requireScope('releases:write'),
    validateParams(ReleaseIdParamSchema),
    async (req, res) => {
      try {
        const { id } = req.params;

        // Check for active rollouts
        const activeRollouts = await prisma.rollout.count({
          where: {
            releaseId: id,
            status: 'in_progress',
          },
        });

        if (activeRollouts > 0) {
          res.status(409).json({
            error: 'Cannot delete release with active rollouts',
            activeRollouts,
          });
          return;
        }

        // Delete release (cascade deletes rollouts and progress)
        await prisma.release.delete({
          where: { id },
        });

        logger.info({ releaseId: id }, 'Release deleted');

        res.status(204).send();
      } catch (error) {
        if ((error as { code?: string }).code === 'P2025') {
          res.status(404).json({ error: 'Release not found' });
          return;
        }
        logger.error({ error }, 'Failed to delete release');
        res.status(500).json({
          error: 'Failed to delete release',
          message: getErrorMessage(error),
        });
      }
    }
  );

  // ======================== Rollout Management ========================

  /**
   * POST /api/v1/releases/:id/rollout
   * Start a rollout for a release
   */
  router.post(
    '/:id/rollout',
    requireScope('releases:write'),
    validateParams(ReleaseIdParamSchema),
    validateBody(StartRolloutBodySchema),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { strategy, targetTags, sensorIds, batchSize, batchDelay } =
          req.body as z.infer<typeof StartRolloutBodySchema>;
        const auth = req.auth!;

        // Verify release exists
        const release = await prisma.release.findUnique({
          where: { id },
        });

        if (!release) {
          res.status(404).json({ error: 'Release not found' });
          return;
        }

        // Build sensor query using proper Prisma types
        const sensorWhere: Prisma.SensorWhereInput = {
          tenantId: auth.tenantId,
          connectionState: 'CONNECTED',
        };

        // Filter by specific sensor IDs if provided
        if (sensorIds && sensorIds.length > 0) {
          sensorWhere.id = { in: sensorIds };
        }

        // Filter by tags if provided
        if (targetTags && targetTags.length > 0) {
          sensorWhere.metadata = {
            path: ['tags'],
            array_contains: targetTags[0], // Simplified - production would handle multiple tags
          };
        }

        // Get target sensors
        const sensors = await prisma.sensor.findMany({
          where: sensorWhere,
          select: { id: true, name: true, version: true },
        });

        if (sensors.length === 0) {
          res.status(400).json({
            error: 'No eligible sensors found for rollout',
          });
          return;
        }

        // Create rollout with progress entries
        const rollout = await prisma.rollout.create({
          data: {
            releaseId: id,
            strategy,
            status: 'pending',
            targetTags: targetTags || [],
            batchSize,
            batchDelay,
            progress: {
              create: sensors.map((sensor) => ({
                sensorId: sensor.id,
                status: 'pending',
              })),
            },
          },
          include: {
            progress: true,
          },
        });

        logger.info(
          {
            rolloutId: rollout.id,
            releaseId: id,
            version: release.version,
            sensorCount: sensors.length,
            strategy,
          },
          'Rollout created'
        );

        // Enqueue rollout for background execution
        // This uses BullMQ to process the rollout in a worker, surviving server restarts
        const { jobId } = await orchestrator.enqueueRollout(
          auth.tenantId,
          rollout.id,
          release,
          sensors,
          {
            strategy,
            batchSize,
            batchDelay,
          }
        );

        res.status(202).json({
          rolloutId: rollout.id,
          jobId,
          releaseVersion: release.version,
          strategy,
          targetSensors: sensors.length,
          status: 'pending',
        });
      } catch (error) {
        logger.error({ error }, 'Failed to start rollout');
        res.status(500).json({
          error: 'Failed to start rollout',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/releases/rollouts/:id
   * Get rollout status and progress
   */
  router.get(
    '/rollouts/:id',
    requireScope('releases:read'),
    validateParams(RolloutIdParamSchema),
    async (req, res) => {
      try {
        const { id } = req.params;

        const rollout = await prisma.rollout.findUnique({
          where: { id },
          include: {
            release: {
              select: {
                version: true,
                changelog: true,
              },
            },
            progress: {
              include: {
                // Note: This assumes a relation to Sensor model
                // If not defined, adjust accordingly
              },
              orderBy: { updatedAt: 'desc' },
            },
          },
        });

        if (!rollout) {
          res.status(404).json({ error: 'Rollout not found' });
          return;
        }

        // Get sensor details for progress entries
        const sensorIds = rollout.progress.map((p: ProgressEntry) => p.sensorId);
        const sensors = await prisma.sensor.findMany({
          where: { id: { in: sensorIds } },
          select: { id: true, name: true, version: true, region: true },
        });

        const sensorMap = new Map(sensors.map((s) => [s.id, s]));

        // Calculate summary
        const summary: RolloutSummary = {
          total: rollout.progress.length,
          pending: 0,
          downloading: 0,
          ready: 0,
          activated: 0,
          failed: 0,
        };

        const progressWithSensors = rollout.progress.map((p: ProgressEntry) => {
          // Update summary
          switch (p.status) {
            case 'pending':
              summary.pending++;
              break;
            case 'downloading':
              summary.downloading++;
              break;
            case 'ready':
              summary.ready++;
              break;
            case 'activated':
              summary.activated++;
              break;
            case 'failed':
              summary.failed++;
              break;
          }

          const sensor = sensorMap.get(p.sensorId);
          return {
            id: p.id,
            sensorId: p.sensorId,
            sensorName: sensor?.name || 'Unknown',
            sensorRegion: sensor?.region || 'Unknown',
            currentVersion: sensor?.version || 'Unknown',
            status: p.status,
            error: p.error,
            updatedAt: p.updatedAt,
          };
        });

        res.json({
          id: rollout.id,
          releaseId: rollout.releaseId,
          releaseVersion: rollout.release.version,
          strategy: rollout.strategy,
          status: rollout.status,
          targetTags: rollout.targetTags,
          batchSize: rollout.batchSize,
          batchDelay: rollout.batchDelay,
          startedAt: rollout.startedAt,
          completedAt: rollout.completedAt,
          summary,
          progress: progressWithSensors,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get rollout status');
        res.status(500).json({
          error: 'Failed to get rollout status',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * POST /api/v1/releases/rollouts/:id/cancel
   * Cancel an in-progress rollout
   */
  router.post(
    '/rollouts/:id/cancel',
    requireScope('releases:write'),
    validateParams(RolloutIdParamSchema),
    async (req, res) => {
      try {
        const { id } = req.params;

        const rollout = await prisma.rollout.findUnique({
          where: { id },
        });

        if (!rollout) {
          res.status(404).json({ error: 'Rollout not found' });
          return;
        }

        if (rollout.status !== 'in_progress' && rollout.status !== 'pending') {
          res.status(400).json({
            error: 'Can only cancel pending or in-progress rollouts',
            currentStatus: rollout.status,
          });
          return;
        }

        // Update rollout status
        const updated = await prisma.rollout.update({
          where: { id },
          data: {
            status: 'cancelled',
            completedAt: new Date(),
          },
        });

        // Update pending progress entries
        await prisma.rolloutProgress.updateMany({
          where: {
            rolloutId: id,
            status: 'pending',
          },
          data: {
            status: 'cancelled',
          },
        });

        logger.info({ rolloutId: id }, 'Rollout cancelled');

        res.json({
          id: updated.id,
          status: updated.status,
          message: 'Rollout cancelled',
        });
      } catch (error) {
        logger.error({ error }, 'Failed to cancel rollout');
        res.status(500).json({
          error: 'Failed to cancel rollout',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/releases/rollouts
   * List all rollouts with filtering
   */
  router.get(
    '/rollouts',
    requireScope('releases:read'),
    validateQuery(ListRolloutsQuerySchema),
    async (req, res) => {
      try {
        const { status, releaseId, limit, offset } = req.query as unknown as z.infer<
          typeof ListRolloutsQuerySchema
        >;

        const where: { status?: string; releaseId?: string } = {};
        if (status) where.status = status;
        if (releaseId) where.releaseId = releaseId;

        const [rollouts, total] = await Promise.all([
          prisma.rollout.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { startedAt: 'desc' },
            include: {
              release: {
                select: {
                  version: true,
                },
              },
              _count: {
                select: {
                  progress: true,
                },
              },
            },
          }),
          prisma.rollout.count({ where }),
        ]);

        res.json({
          rollouts: rollouts.map((r: RolloutListItem) => ({
            id: r.id,
            releaseId: r.releaseId,
            releaseVersion: r.release.version,
            strategy: r.strategy,
            status: r.status,
            targetSensors: r._count.progress,
            startedAt: r.startedAt,
            completedAt: r.completedAt,
          })),
          pagination: { total, limit, offset },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to list rollouts');
        res.status(500).json({
          error: 'Failed to list rollouts',
          message: getErrorMessage(error),
        });
      }
    }
  );

  return router;
}
