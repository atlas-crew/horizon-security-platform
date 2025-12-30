/**
 * Tunnel API Routes
 *
 * REST endpoints for managing WebSocket tunnel sessions between
 * Signal Horizon and remote sensors.
 */

import { Router, type Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { randomUUID } from 'crypto';

// ============================================================================
// Zod Schemas
// ============================================================================

const TunnelSessionSchema = z.object({
  sessionId: z.string().uuid(),
  sensorId: z.string(),
  userId: z.string(),
  tenantId: z.string(),
  type: z.enum(['shell', 'dashboard']),
  status: z.enum(['pending', 'connected', 'disconnected', 'error']),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime().nullish(),
});

// ============================================================================
// Route Factory
// ============================================================================

export function createTunnelRoutes(prisma: PrismaClient, logger: Logger): Router {
  const router = Router();

  // In-memory session store (in production, use Redis)
  const sessions = new Map<string, z.infer<typeof TunnelSessionSchema>>();

  /**
   * GET /tunnel/status/:sensorId
   * Check tunnel availability for a sensor
   */
  router.get('/status/:sensorId', async (req, res): Promise<Response | void> => {
    const { sensorId } = req.params;
    const tenantId = req.headers['x-org-id'] as string;

    try {
      // Verify sensor exists and belongs to tenant
      const sensor = await prisma.sensor.findFirst({
        where: { id: sensorId, tenantId },
        select: { id: true, connectionState: true, lastHeartbeat: true },
      });

      if (!sensor) {
        return res.status(404).json({ error: 'Sensor not found' });
      }

      // Check if sensor is online (seen within last 2 minutes)
      const isOnline = sensor.lastHeartbeat &&
        new Date().getTime() - new Date(sensor.lastHeartbeat).getTime() < 120000;

      return res.json({
        sensorId,
        available: isOnline,
        connectionState: sensor.connectionState,
        capabilities: isOnline ? ['shell', 'dashboard'] : [],
        lastHeartbeat: sensor.lastHeartbeat,
      });
    } catch (error) {
      logger.error({ error, sensorId }, 'Failed to check tunnel status');
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /tunnel/shell/:sensorId
   * Request a new shell session to a sensor
   */
  router.post('/shell/:sensorId', async (req, res): Promise<Response | void> => {
    const { sensorId } = req.params;
    const tenantId = req.headers['x-org-id'] as string;
    const userId = (req.headers['x-user-id'] as string) || 'anonymous';

    try {
      // Verify sensor exists and belongs to tenant
      const sensor = await prisma.sensor.findFirst({
        where: { id: sensorId, tenantId },
        select: { id: true, connectionState: true, lastHeartbeat: true },
      });

      if (!sensor) {
        return res.status(404).json({ error: 'Sensor not found' });
      }

      // Check if sensor is online
      const isOnline = sensor.lastHeartbeat &&
        new Date().getTime() - new Date(sensor.lastHeartbeat).getTime() < 120000;

      if (!isOnline) {
        return res.status(503).json({
          error: 'Sensor offline',
          lastHeartbeat: sensor.lastHeartbeat,
        });
      }

      // Create session
      const sessionId = randomUUID();
      const session: z.infer<typeof TunnelSessionSchema> = {
        sessionId,
        sensorId,
        userId,
        tenantId,
        type: 'shell',
        status: 'pending',
        createdAt: new Date().toISOString(),
        lastActivity: null,
      };

      sessions.set(sessionId, session);
      logger.info({ sessionId, sensorId, userId }, 'Shell session created');

      return res.status(201).json({
        sessionId,
        sensorId,
        type: 'shell',
        wsUrl: `/ws/tunnel/user/${sessionId}`,
        expiresIn: 300, // 5 minutes to connect
      });
    } catch (error) {
      logger.error({ error, sensorId }, 'Failed to create shell session');
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /tunnel/dashboard/:sensorId
   * Request a new dashboard proxy session to a sensor
   */
  router.post('/dashboard/:sensorId', async (req, res): Promise<Response | void> => {
    const { sensorId } = req.params;
    const tenantId = req.headers['x-org-id'] as string;
    const userId = (req.headers['x-user-id'] as string) || 'anonymous';

    try {
      // Verify sensor exists and belongs to tenant
      const sensor = await prisma.sensor.findFirst({
        where: { id: sensorId, tenantId },
        select: { id: true, connectionState: true, lastHeartbeat: true },
      });

      if (!sensor) {
        return res.status(404).json({ error: 'Sensor not found' });
      }

      // Check if sensor is online
      const isOnline = sensor.lastHeartbeat &&
        new Date().getTime() - new Date(sensor.lastHeartbeat).getTime() < 120000;

      if (!isOnline) {
        return res.status(503).json({
          error: 'Sensor offline',
          lastHeartbeat: sensor.lastHeartbeat,
        });
      }

      // Create session
      const sessionId = randomUUID();
      const session: z.infer<typeof TunnelSessionSchema> = {
        sessionId,
        sensorId,
        userId,
        tenantId,
        type: 'dashboard',
        status: 'pending',
        createdAt: new Date().toISOString(),
        lastActivity: null,
      };

      sessions.set(sessionId, session);
      logger.info({ sessionId, sensorId, userId }, 'Dashboard session created');

      return res.status(201).json({
        sessionId,
        sensorId,
        type: 'dashboard',
        wsUrl: `/ws/tunnel/user/${sessionId}`,
        proxyUrl: `/api/v1/tunnel/proxy/${sessionId}`,
        expiresIn: 300, // 5 minutes to connect
      });
    } catch (error) {
      logger.error({ error, sensorId }, 'Failed to create dashboard session');
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /tunnel/session/:sessionId
   * Get session status
   */
  router.get('/session/:sessionId', (req, res): Response => {
    const { sessionId } = req.params;
    const tenantId = req.headers['x-org-id'] as string;

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify tenant ownership
    if (session.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json(session);
  });

  /**
   * DELETE /tunnel/session/:sessionId
   * Terminate a session
   */
  router.delete('/session/:sessionId', (req, res): Response => {
    const { sessionId } = req.params;
    const tenantId = req.headers['x-org-id'] as string;

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify tenant ownership
    if (session.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    sessions.delete(sessionId);
    logger.info({ sessionId }, 'Session terminated');

    return res.status(204).send();
  });

  /**
   * GET /tunnel/sessions
   * List active sessions for the tenant
   */
  router.get('/sessions', (req, res): Response => {
    const tenantId = req.headers['x-org-id'] as string;

    const tenantSessions = Array.from(sessions.values())
      .filter(s => s.tenantId === tenantId)
      .map(s => ({
        sessionId: s.sessionId,
        sensorId: s.sensorId,
        type: s.type,
        status: s.status,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
      }));

    return res.json({
      sessions: tenantSessions,
      total: tenantSessions.length,
    });
  });

  return router;
}
