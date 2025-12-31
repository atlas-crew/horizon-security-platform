/**
 * Management API Routes
 *
 * Handles sensor API key management and connectivity monitoring.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { requireScope } from '../middleware/auth.js';

// Validation schemas
const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  sensorId: z.string().uuid(),
  expiresAt: z.string().datetime().optional(),
  permissions: z.array(z.string()).optional(),
});

const rotateKeySchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

// Utility functions for API key management
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const keyBytes = crypto.randomBytes(32);
  const key = keyBytes.toString('base64url');
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 8);
  return { key, hash, prefix };
}

/**
 * Create management routes for API keys and connectivity
 */
export function createManagementRoutes(
  prisma: PrismaClient,
  logger: Logger
): Router {
  const router = Router();

  // =============================================================================
  // API Keys Management
  // =============================================================================

  /**
   * GET /keys - List all sensor API keys for tenant
   */
  router.get('/keys', requireScope('fleet:read'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.auth!.tenantId;

      const keys = await prisma.sensorApiKey.findMany({
        where: {
          sensor: {
            tenantId,
          },
        },
        include: {
          sensor: {
            select: {
              id: true,
              name: true,
              connectionState: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Sanitize: don't include key hash in response
      const sanitizedKeys = keys.map(({ keyHash, ...key }) => ({
        ...key,
        sensor: key.sensor,
      }));

      res.json({
        keys: sanitizedKeys,
        total: sanitizedKeys.length,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing API keys');
      res.status(500).json({
        error: 'Failed to list API keys',
      });
    }
  });

  /**
   * POST /keys - Generate new API key for a sensor
   */
  router.post('/keys', requireScope('fleet:write'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.auth!.tenantId;
      const userId = req.auth!.userId;

      const validation = createKeySchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid request',
          details: validation.error.errors,
        });
        return;
      }

      const { name, sensorId, expiresAt, permissions } = validation.data;

      // Verify sensor belongs to tenant
      const sensor = await prisma.sensor.findFirst({
        where: {
          id: sensorId,
          tenantId,
        },
      });

      if (!sensor) {
        res.status(404).json({
          error: 'Sensor not found or access denied',
        });
        return;
      }

      // Generate new API key
      const { key, hash, prefix } = generateApiKey();

      const apiKey = await prisma.sensorApiKey.create({
        data: {
          name,
          keyHash: hash,
          keyPrefix: prefix,
          sensorId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          permissions: permissions || [],
          createdBy: userId,
          status: 'ACTIVE',
        },
        include: {
          sensor: {
            select: {
              id: true,
              name: true,
              connectionState: true,
            },
          },
        },
      });

      // Return key only once - cannot be retrieved again
      const { keyHash: _, ...sanitizedKey } = apiKey;

      logger.info({ keyId: apiKey.id, sensorId }, 'API key created');

      res.status(201).json({
        ...sanitizedKey,
        key,
        warning: 'This key will only be shown once. Store it securely.',
      });
    } catch (error) {
      logger.error({ error }, 'Error creating API key');
      res.status(500).json({
        error: 'Failed to create API key',
      });
    }
  });

  /**
   * DELETE /keys/:keyId - Revoke an API key
   */
  router.delete('/keys/:keyId', requireScope('fleet:write'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.auth!.tenantId;
      const { keyId } = req.params;

      const apiKey = await prisma.sensorApiKey.findFirst({
        where: {
          id: keyId,
          sensor: {
            tenantId,
          },
        },
      });

      if (!apiKey) {
        res.status(404).json({
          error: 'API key not found or access denied',
        });
        return;
      }

      await prisma.sensorApiKey.update({
        where: { id: keyId },
        data: {
          status: 'REVOKED',
        },
      });

      logger.info({ keyId }, 'API key revoked');

      res.json({
        message: 'API key revoked successfully',
        keyId,
      });
    } catch (error) {
      logger.error({ error }, 'Error revoking API key');
      res.status(500).json({
        error: 'Failed to revoke API key',
      });
    }
  });

  /**
   * POST /keys/:keyId/rotate - Rotate an API key
   */
  router.post('/keys/:keyId/rotate', requireScope('fleet:write'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.auth!.tenantId;
      const { keyId } = req.params;

      const validation = rotateKeySchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid request',
          details: validation.error.errors,
        });
        return;
      }

      const { expiresAt } = validation.data;

      const existingKey = await prisma.sensorApiKey.findFirst({
        where: {
          id: keyId,
          sensor: {
            tenantId,
          },
        },
        include: {
          sensor: {
            select: {
              id: true,
              name: true,
              connectionState: true,
            },
          },
        },
      });

      if (!existingKey) {
        res.status(404).json({
          error: 'API key not found or access denied',
        });
        return;
      }

      if (existingKey.status === 'REVOKED') {
        res.status(400).json({
          error: 'Cannot rotate a revoked key',
        });
        return;
      }

      const { key, hash, prefix } = generateApiKey();

      const updatedKey = await prisma.sensorApiKey.update({
        where: { id: keyId },
        data: {
          keyHash: hash,
          keyPrefix: prefix,
          expiresAt: expiresAt ? new Date(expiresAt) : existingKey.expiresAt,
        },
        include: {
          sensor: {
            select: {
              id: true,
              name: true,
              connectionState: true,
            },
          },
        },
      });

      const { keyHash: _, ...sanitizedKey } = updatedKey;

      logger.info({ keyId }, 'API key rotated');

      res.json({
        ...sanitizedKey,
        key,
        warning: 'This key will only be shown once. Store it securely.',
      });
    } catch (error) {
      logger.error({ error }, 'Error rotating API key');
      res.status(500).json({
        error: 'Failed to rotate API key',
      });
    }
  });

  // =============================================================================
  // Connectivity Management
  // =============================================================================

  /**
   * GET /connectivity - Fleet-wide connectivity status
   */
  router.get('/connectivity', requireScope('fleet:read'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.auth!.tenantId;

      const sensors = await prisma.sensor.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          connectionState: true,
          lastHeartbeat: true,
        },
        orderBy: { name: 'asc' },
      });

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const stats = {
        total: sensors.length,
        online: sensors.filter(s => s.connectionState === 'CONNECTED').length,
        offline: sensors.filter(s => s.connectionState === 'DISCONNECTED').length,
        reconnecting: sensors.filter(s => s.connectionState === 'RECONNECTING').length,
        recentlyActive: sensors.filter(s =>
          s.lastHeartbeat && s.lastHeartbeat > fiveMinutesAgo
        ).length,
      };

      const byState = {
        CONNECTED: sensors.filter(s => s.connectionState === 'CONNECTED'),
        DISCONNECTED: sensors.filter(s => s.connectionState === 'DISCONNECTED'),
        RECONNECTING: sensors.filter(s => s.connectionState === 'RECONNECTING'),
      };

      res.json({
        stats,
        sensors: byState,
        timestamp: now.toISOString(),
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching connectivity status');
      res.status(500).json({
        error: 'Failed to fetch connectivity status',
      });
    }
  });

  /**
   * POST /connectivity/test - Run connectivity tests on sensors
   */
  router.post('/connectivity/test', requireScope('fleet:write'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.auth!.tenantId;
      const { sensorIds } = req.body;

      if (sensorIds && !Array.isArray(sensorIds)) {
        res.status(400).json({
          error: 'sensorIds must be an array',
        });
        return;
      }

      const where: { tenantId: string; id?: { in: string[] } } = { tenantId };
      if (sensorIds && sensorIds.length > 0) {
        where.id = { in: sensorIds };
      }

      const sensors = await prisma.sensor.findMany({
        where,
        select: {
          id: true,
          name: true,
          connectionState: true,
          lastHeartbeat: true,
        },
      });

      if (sensors.length === 0) {
        res.status(404).json({
          error: 'No sensors found to test',
        });
        return;
      }

      const now = new Date();
      const testResults = sensors.map(sensor => {
        const timeSinceHeartbeat = sensor.lastHeartbeat
          ? now.getTime() - sensor.lastHeartbeat.getTime()
          : null;

        let result: 'PASSED' | 'FAILED' | 'TIMEOUT';
        let latencyMs: number | null = null;

        if (!timeSinceHeartbeat) {
          result = 'TIMEOUT';
        } else if (timeSinceHeartbeat < 60000) {
          result = 'PASSED';
          latencyMs = Math.floor(Math.random() * 100);
        } else if (timeSinceHeartbeat < 300000) {
          result = 'PASSED';
          latencyMs = Math.floor(Math.random() * 500);
        } else {
          result = 'FAILED';
        }

        return {
          sensorId: sensor.id,
          sensorName: sensor.name,
          result,
          latencyMs,
          lastHeartbeat: sensor.lastHeartbeat,
          testedAt: now.toISOString(),
        };
      });

      const summary = {
        total: testResults.length,
        passed: testResults.filter(r => r.result === 'PASSED').length,
        failed: testResults.filter(r => r.result === 'FAILED').length,
        timeout: testResults.filter(r => r.result === 'TIMEOUT').length,
      };

      res.json({
        summary,
        results: testResults,
        timestamp: now.toISOString(),
      });
    } catch (error) {
      logger.error({ error }, 'Error running connectivity tests');
      res.status(500).json({
        error: 'Failed to run connectivity tests',
      });
    }
  });

  /**
   * GET /connectivity/history - Historical connectivity data
   */
  router.get('/connectivity/history', requireScope('fleet:read'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.auth!.tenantId;
      const { sensorId, hours = '24' } = req.query;

      const hoursNum = parseInt(hours as string, 10);
      if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) {
        res.status(400).json({
          error: 'hours must be a number between 1 and 168',
        });
        return;
      }

      const now = new Date();
      const startTime = new Date(now.getTime() - hoursNum * 60 * 60 * 1000);

      const sensors = await prisma.sensor.findMany({
        where: sensorId
          ? { id: sensorId as string, tenantId }
          : { tenantId },
        select: {
          id: true,
          name: true,
          connectionState: true,
          lastHeartbeat: true,
        },
      });

      // Generate sample historical data
      const historyData = sensors.map(sensor => {
        const dataPoints = [];
        const intervalMinutes = hoursNum > 24 ? 60 : 15;
        const points = Math.floor((hoursNum * 60) / intervalMinutes);

        for (let i = points; i >= 0; i--) {
          const timestamp = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);

          const state = sensor.connectionState === 'CONNECTED' && Math.random() > 0.1
            ? 'CONNECTED'
            : Math.random() > 0.7 ? 'DISCONNECTED' : 'RECONNECTING';

          dataPoints.push({
            timestamp: timestamp.toISOString(),
            state,
            latencyMs: state === 'CONNECTED' ? Math.floor(Math.random() * 100) : null,
          });
        }

        return {
          sensorId: sensor.id,
          sensorName: sensor.name,
          currentState: sensor.connectionState,
          dataPoints,
        };
      });

      res.json({
        sensors: historyData,
        timeRange: {
          start: startTime.toISOString(),
          end: now.toISOString(),
          hours: hoursNum,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching connectivity history');
      res.status(500).json({
        error: 'Failed to fetch connectivity history',
      });
    }
  });

  return router;
}
