/**
 * Fleet Control API Routes
 *
 * REST endpoints for remote service control operations on Synapse WAF sensors.
 * Supports the following control commands:
 * - reload: Hot-reload configuration without restart
 * - restart: Graceful restart (drain connections first)
 * - shutdown: Graceful shutdown (drain connections first)
 * - drain: Stop accepting new connections, finish existing
 * - resume: Resume accepting connections after drain
 *
 * Security:
 * - All routes require authentication via API key
 * - Scope requirements:
 *   - sensor:control - reload, drain, resume
 *   - sensor:admin - restart, shutdown
 * - Destructive commands (restart, shutdown) require X-Confirm-Token header
 * - All operations are logged for audit purposes
 *
 * @module fleet-control
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireScope } from '../middleware/auth.js';
import { validateParams } from '../middleware/validation.js';
import { getErrorMessage } from '../../utils/errors.js';
import type { TunnelBroker } from '../../websocket/tunnel-broker.js';

// =============================================================================
// Constants
// =============================================================================

/** Commands that require confirmation token */
const DESTRUCTIVE_COMMANDS = ['restart', 'shutdown'] as const;

/** Scope required for destructive commands */
const ADMIN_SCOPE = 'sensor:admin';

/** Scope required for non-destructive commands */
const CONTROL_SCOPE = 'sensor:control';

/** HTTP status code for precondition required (no confirmation token) */
const PRECONDITION_REQUIRED = 428;

// =============================================================================
// Validation Schemas
// =============================================================================

/**
 * Valid control command types
 */
const ControlCommandSchema = z.enum(['reload', 'restart', 'shutdown', 'drain', 'resume']);
type ControlCommand = z.infer<typeof ControlCommandSchema>;

/**
 * Route parameters for control endpoints
 */
const SensorControlParamsSchema = z.object({
  sensorId: z.string().min(1, 'sensorId is required'),
  command: ControlCommandSchema,
});

/**
 * Route parameters for state endpoint
 */
const SensorIdParamsSchema = z.object({
  sensorId: z.string().min(1, 'sensorId is required'),
});

/**
 * Request body for control commands (optional)
 */
const ControlCommandBodySchema = z.object({
  /** Optional reason for the command (for audit logging) */
  reason: z.string().max(500).optional(),
  /** Optional metadata to include with the command */
  metadata: z.record(z.unknown()).optional(),
}).optional();

// =============================================================================
// Types
// =============================================================================

/**
 * Service state returned by the sensor
 */
type ServiceState = 'running' | 'draining' | 'restarting' | 'shutting_down';

/**
 * Control command result from the sensor
 */
interface ControlResult {
  command: ControlCommand;
  success: boolean;
  message: string;
  state: ServiceState;
  details?: Record<string, unknown>;
}

/**
 * Audit log entry for control operations
 */
interface ControlAuditLog {
  id: string;
  timestamp: Date;
  sensorId: string;
  tenantId: string;
  userId: string | null;
  apiKeyId: string;
  command: ControlCommand;
  confirmed: boolean;
  clientIp: string | null;
  userAgent: string | null;
  reason: string | null;
  result: 'pending' | 'success' | 'failure' | 'timeout';
  errorMessage: string | null;
  durationMs: number | null;
}

/**
 * Options for creating fleet control routes
 */
export interface FleetControlRoutesOptions {
  tunnelBroker?: TunnelBroker;
}

// =============================================================================
// Route Factory
// =============================================================================

/**
 * Create fleet control API routes.
 *
 * @param prisma - Prisma client for database access
 * @param logger - Pino logger instance
 * @param options - Optional configuration including tunnel broker
 * @returns Express router with fleet control endpoints
 */
export function createFleetControlRoutes(
  prisma: PrismaClient,
  logger: Logger,
  options: FleetControlRoutesOptions = {}
): Router {
  const router = Router();
  const log = logger.child({ module: 'fleet-control' });
  const { tunnelBroker } = options;

  // In-memory audit log store (in production, persist to database)
  const auditLogs = new Map<string, ControlAuditLog>();

  // =========================================================================
  // Helper Functions
  // =========================================================================

  /**
   * Check if a command requires admin scope
   */
  function requiresAdminScope(command: ControlCommand): boolean {
    return (DESTRUCTIVE_COMMANDS as readonly string[]).includes(command);
  }

  /**
   * Create an audit log entry for a control operation
   */
  function createAuditLog(
    req: Request,
    sensorId: string,
    command: ControlCommand,
    confirmed: boolean,
    reason?: string
  ): ControlAuditLog {
    const entry: ControlAuditLog = {
      id: randomUUID(),
      timestamp: new Date(),
      sensorId,
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId ?? null,
      apiKeyId: req.auth!.apiKeyId,
      command,
      confirmed,
      clientIp: req.ip ?? req.headers['x-forwarded-for']?.toString() ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      reason: reason ?? null,
      result: 'pending',
      errorMessage: null,
      durationMs: null,
    };

    auditLogs.set(entry.id, entry);

    log.info(
      {
        auditId: entry.id,
        sensorId,
        command,
        tenantId: entry.tenantId,
        userId: entry.userId,
        confirmed,
        reason,
      },
      'Control command initiated'
    );

    return entry;
  }

  /**
   * Update an audit log entry with the result
   */
  function updateAuditLog(
    auditId: string,
    result: 'success' | 'failure' | 'timeout',
    errorMessage: string | null,
    durationMs: number
  ): void {
    const entry = auditLogs.get(auditId);
    if (entry) {
      entry.result = result;
      entry.errorMessage = errorMessage;
      entry.durationMs = durationMs;

      log.info(
        {
          auditId,
          sensorId: entry.sensorId,
          command: entry.command,
          result,
          durationMs,
          errorMessage,
        },
        'Control command completed'
      );
    }
  }

  /**
   * Send a control command to the sensor via tunnel
   */
  async function sendControlCommand(
    sensorId: string,
    command: ControlCommand,
    confirmToken: string | undefined,
    _metadata?: Record<string, unknown>
  ): Promise<ControlResult> {
    // If tunnel broker is available, use it to send the command
    if (tunnelBroker) {
      // Check if sensor has an active tunnel
      const tunnelStatus = tunnelBroker.getTunnelStatus(sensorId);
      if (!tunnelStatus) {
        return {
          command,
          success: false,
          message: 'Sensor tunnel not connected',
          state: 'running',
          details: {
            sensorId,
            tunnelConnected: false,
          },
        };
      }

      // Create a control message using the legacy protocol format
      // which supports sending directly to the sensor via the tunnel
      const requestId = randomUUID();
      const controlMessage = {
        type: 'dashboard-request' as const,
        sessionId: requestId, // Use requestId as session identifier for tracking
        payload: {
          action: 'control',
          command,
          confirmToken,
          requestId,
          timestamp: Date.now(),
        },
        timestamp: new Date().toISOString(),
      };

      // Send directly to the sensor's tunnel socket
      // The tunnel broker's legacy interface routes by sensorId
      const tunnel = tunnelBroker.getTunnelStatus(sensorId);
      if (tunnel && tunnel.socket && tunnel.socket.readyState === 1 /* OPEN */) {
        try {
          tunnel.socket.send(JSON.stringify(controlMessage));
          // In a real implementation, we would wait for the response via the tunnel
          // For now, return a pending result
          return {
            command,
            success: true,
            message: `Command ${command} sent to sensor`,
            state: 'running',
            details: {
              requestId,
              note: 'Command dispatched via tunnel, awaiting sensor acknowledgment',
            },
          };
        } catch (error) {
          log.error({ error, sensorId, command }, 'Failed to send control command to tunnel');
          return {
            command,
            success: false,
            message: 'Failed to send command to sensor tunnel',
            state: 'running',
            details: { requestId, error: getErrorMessage(error) },
          };
        }
      }

      return {
        command,
        success: false,
        message: 'Sensor tunnel socket not available',
        state: 'running',
        details: { requestId, sensorId },
      };
    }

    // No tunnel broker - return mock/simulated response for development
    return simulateControlCommand(sensorId, command);
  }

  /**
   * Simulate a control command response (for development without tunnel)
   */
  function simulateControlCommand(
    sensorId: string,
    command: ControlCommand
  ): ControlResult {
    // Simulate command execution
    const stateMap: Record<ControlCommand, ServiceState> = {
      reload: 'running',
      restart: 'restarting',
      shutdown: 'shutting_down',
      drain: 'draining',
      resume: 'running',
    };

    const messageMap: Record<ControlCommand, string> = {
      reload: 'Configuration reload initiated',
      restart: 'Graceful restart initiated, draining connections',
      shutdown: 'Graceful shutdown initiated, draining connections',
      drain: 'Now draining connections, rejecting new requests',
      resume: 'Resumed accepting connections',
    };

    return {
      command,
      success: true,
      message: messageMap[command],
      state: stateMap[command],
      details: {
        sensorId,
        simulated: true,
        timestamp: Date.now(),
      },
    };
  }

  // =========================================================================
  // Routes
  // =========================================================================

  /**
   * POST /api/v1/fleet-control/:sensorId/control/:command
   *
   * Execute a control command on a sensor.
   *
   * Required scopes:
   * - sensor:control for reload, drain, resume
   * - sensor:admin for restart, shutdown
   *
   * Headers:
   * - X-Confirm-Token (required for restart, shutdown)
   *
   * Response codes:
   * - 200: Command executed successfully
   * - 400: Invalid command
   * - 403: Insufficient permissions
   * - 404: Sensor not found
   * - 428: Confirmation required (missing X-Confirm-Token)
   * - 503: Sensor offline or tunnel not connected
   * - 504: Command timeout
   */
  router.post(
    '/:sensorId/control/:command',
    requireScope(CONTROL_SCOPE, ADMIN_SCOPE),
    validateParams(SensorControlParamsSchema),
    async (req: Request, res: Response): Promise<void> => {
      const startTime = Date.now();
      const { sensorId, command } = req.params as z.infer<typeof SensorControlParamsSchema>;
      const auth = req.auth!;
      const confirmToken = req.headers['x-confirm-token'] as string | undefined;
      const body = ControlCommandBodySchema.safeParse(req.body);
      const reason = body.success ? body.data?.reason : undefined;

      try {
        // Check scope requirements
        if (requiresAdminScope(command) && !auth.scopes.includes(ADMIN_SCOPE)) {
          res.status(403).json({
            error: 'Insufficient permissions',
            message: `Command '${command}' requires ${ADMIN_SCOPE} scope`,
            required: [ADMIN_SCOPE],
            granted: auth.scopes,
          });
          return;
        }

        // Check for confirmation token on destructive commands
        if (requiresAdminScope(command) && !confirmToken) {
          res.status(PRECONDITION_REQUIRED).json({
            error: 'Confirmation required',
            message: `Destructive command '${command}' requires X-Confirm-Token header`,
            command,
            hint: 'Include a unique confirmation token in the X-Confirm-Token header',
          });
          return;
        }

        // Verify sensor exists and belongs to tenant
        const sensor = await prisma.sensor.findFirst({
          where: {
            id: sensorId,
            tenantId: auth.tenantId,
          },
          select: {
            id: true,
            name: true,
            connectionState: true,
            lastHeartbeat: true,
            tunnelActive: true,
          },
        });

        if (!sensor) {
          res.status(404).json({
            error: 'Sensor not found',
            sensorId,
          });
          return;
        }

        // Check if sensor is online (has heartbeat within last 2 minutes)
        const isOnline =
          sensor.connectionState === 'CONNECTED' ||
          (sensor.lastHeartbeat &&
            Date.now() - new Date(sensor.lastHeartbeat).getTime() < 120000);

        if (!isOnline) {
          res.status(503).json({
            error: 'Sensor offline',
            sensorId,
            lastHeartbeat: sensor.lastHeartbeat,
            connectionState: sensor.connectionState,
          });
          return;
        }

        // Create audit log entry
        const auditEntry = createAuditLog(
          req,
          sensorId,
          command,
          !!confirmToken,
          reason
        );

        // Execute the command
        const result = await sendControlCommand(
          sensorId,
          command,
          confirmToken,
          body.success ? body.data?.metadata : undefined
        );

        const durationMs = Date.now() - startTime;

        // Update audit log
        updateAuditLog(
          auditEntry.id,
          result.success ? 'success' : 'failure',
          result.success ? null : result.message,
          durationMs
        );

        // Return result
        res.status(result.success ? 200 : 500).json({
          ...result,
          sensorId,
          sensorName: sensor.name,
          auditId: auditEntry.id,
          timestamp: new Date().toISOString(),
          durationMs,
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;
        log.error(
          { error, sensorId, command },
          'Failed to execute control command'
        );

        res.status(500).json({
          error: 'Failed to execute control command',
          message: getErrorMessage(error),
          command,
          sensorId,
          durationMs,
        });
      }
    }
  );

  /**
   * GET /api/v1/fleet-control/:sensorId/state
   *
   * Get the current service state for a sensor.
   *
   * Required scope: sensor:control
   *
   * Response:
   * - state: Current service state (running, draining, restarting, shutting_down)
   * - activeConnections: Number of active connections
   * - isAccepting: Whether accepting new connections
   * - uptime: Service uptime in seconds
   * - lastReload: Timestamp of last configuration reload
   */
  router.get(
    '/:sensorId/state',
    requireScope(CONTROL_SCOPE),
    validateParams(SensorIdParamsSchema),
    async (req: Request, res: Response): Promise<void> => {
      const { sensorId } = req.params as z.infer<typeof SensorIdParamsSchema>;
      const auth = req.auth!;

      try {
        // Verify sensor exists and belongs to tenant
        const sensor = await prisma.sensor.findFirst({
          where: {
            id: sensorId,
            tenantId: auth.tenantId,
          },
          select: {
            id: true,
            name: true,
            connectionState: true,
            lastHeartbeat: true,
            uptime: true,
            metadata: true,
          },
        });

        if (!sensor) {
          res.status(404).json({
            error: 'Sensor not found',
            sensorId,
          });
          return;
        }

        // Check if sensor is online
        const isOnline =
          sensor.connectionState === 'CONNECTED' ||
          (sensor.lastHeartbeat &&
            Date.now() - new Date(sensor.lastHeartbeat).getTime() < 120000);

        // Extract state from metadata if available
        const metadata = (sensor.metadata as Record<string, unknown>) || {};
        const serviceState = (metadata.serviceState as ServiceState) || 'running';
        const activeConnections = (metadata.activeConnections as number) || 0;
        const lastReload = metadata.lastReload as string | undefined;

        res.json({
          sensorId,
          sensorName: sensor.name,
          state: serviceState,
          activeConnections,
          isAccepting: serviceState === 'running',
          isOnline,
          connectionState: sensor.connectionState,
          uptime: sensor.uptime || 0,
          lastHeartbeat: sensor.lastHeartbeat,
          lastReload: lastReload || null,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        log.error({ error, sensorId }, 'Failed to get sensor state');

        res.status(500).json({
          error: 'Failed to get sensor state',
          message: getErrorMessage(error),
          sensorId,
        });
      }
    }
  );

  /**
   * GET /api/v1/fleet-control/:sensorId/audit
   *
   * Get control command audit log for a sensor.
   *
   * Required scope: sensor:admin
   *
   * Query parameters:
   * - limit: Maximum entries to return (default: 50, max: 100)
   * - offset: Offset for pagination
   */
  router.get(
    '/:sensorId/audit',
    requireScope(ADMIN_SCOPE),
    validateParams(SensorIdParamsSchema),
    async (req: Request, res: Response): Promise<void> => {
      const { sensorId } = req.params as z.infer<typeof SensorIdParamsSchema>;
      const auth = req.auth!;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      try {
        // Verify sensor exists and belongs to tenant
        const sensor = await prisma.sensor.findFirst({
          where: {
            id: sensorId,
            tenantId: auth.tenantId,
          },
          select: { id: true, name: true },
        });

        if (!sensor) {
          res.status(404).json({
            error: 'Sensor not found',
            sensorId,
          });
          return;
        }

        // Get audit logs for this sensor (filtered by tenant)
        const logs = Array.from(auditLogs.values())
          .filter((log) => log.sensorId === sensorId && log.tenantId === auth.tenantId)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(offset, offset + limit)
          .map((log) => ({
            id: log.id,
            timestamp: log.timestamp.toISOString(),
            command: log.command,
            result: log.result,
            confirmed: log.confirmed,
            reason: log.reason,
            durationMs: log.durationMs,
            errorMessage: log.errorMessage,
            userId: log.userId,
          }));

        const total = Array.from(auditLogs.values()).filter(
          (log) => log.sensorId === sensorId && log.tenantId === auth.tenantId
        ).length;

        res.json({
          sensorId,
          sensorName: sensor.name,
          logs,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        });
      } catch (error) {
        log.error({ error, sensorId }, 'Failed to get audit log');

        res.status(500).json({
          error: 'Failed to get audit log',
          message: getErrorMessage(error),
          sensorId,
        });
      }
    }
  );

  /**
   * POST /api/v1/fleet-control/batch/control/:command
   *
   * Execute a control command on multiple sensors.
   *
   * Request body:
   * - sensorIds: Array of sensor IDs to target
   * - reason: Optional reason for the command
   *
   * Required scopes: Same as individual control endpoint
   *
   * Note: Batch operations run commands in parallel and return
   * results for each sensor.
   */
  router.post(
    '/batch/control/:command',
    requireScope(CONTROL_SCOPE, ADMIN_SCOPE),
    async (req: Request, res: Response): Promise<void> => {
      const startTime = Date.now();
      const auth = req.auth!;
      const { command } = req.params;
      const confirmToken = req.headers['x-confirm-token'] as string | undefined;

      // Validate command
      const commandResult = ControlCommandSchema.safeParse(command);
      if (!commandResult.success) {
        res.status(400).json({
          error: 'Invalid command',
          message: `Command must be one of: ${ControlCommandSchema.options.join(', ')}`,
          received: command,
        });
        return;
      }

      const validCommand = commandResult.data;

      // Validate body
      const bodySchema = z.object({
        sensorIds: z.array(z.string()).min(1).max(50),
        reason: z.string().max(500).optional(),
      });

      const bodyResult = bodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.errors,
        });
        return;
      }

      const { sensorIds, reason } = bodyResult.data;

      try {
        // Check scope requirements
        if (requiresAdminScope(validCommand) && !auth.scopes.includes(ADMIN_SCOPE)) {
          res.status(403).json({
            error: 'Insufficient permissions',
            message: `Command '${validCommand}' requires ${ADMIN_SCOPE} scope`,
          });
          return;
        }

        // Check for confirmation token on destructive commands
        if (requiresAdminScope(validCommand) && !confirmToken) {
          res.status(PRECONDITION_REQUIRED).json({
            error: 'Confirmation required',
            message: `Destructive command '${validCommand}' requires X-Confirm-Token header`,
          });
          return;
        }

        // Verify all sensors exist and belong to tenant
        const sensors = await prisma.sensor.findMany({
          where: {
            id: { in: sensorIds },
            tenantId: auth.tenantId,
          },
          select: {
            id: true,
            name: true,
            connectionState: true,
            lastHeartbeat: true,
          },
        });

        const foundIds = new Set(sensors.map((s) => s.id));
        const notFoundIds = sensorIds.filter((id) => !foundIds.has(id));

        if (notFoundIds.length > 0) {
          res.status(400).json({
            error: 'Some sensors not found',
            notFound: notFoundIds,
            found: Array.from(foundIds),
          });
          return;
        }

        // Execute commands in parallel
        const results = await Promise.all(
          sensors.map(async (sensor) => {
            const isOnline =
              sensor.connectionState === 'CONNECTED' ||
              (sensor.lastHeartbeat &&
                Date.now() - new Date(sensor.lastHeartbeat).getTime() < 120000);

            if (!isOnline) {
              return {
                sensorId: sensor.id,
                sensorName: sensor.name,
                success: false,
                message: 'Sensor offline',
                state: 'unknown' as const,
              };
            }

            // Create audit log
            createAuditLog(req, sensor.id, validCommand, !!confirmToken, reason);

            // Execute command
            const result = await sendControlCommand(
              sensor.id,
              validCommand,
              confirmToken
            );

            return {
              sensorId: sensor.id,
              sensorName: sensor.name,
              ...result,
            };
          })
        );

        const durationMs = Date.now() - startTime;
        const successCount = results.filter((r) => r.success).length;
        const failureCount = results.filter((r) => !r.success).length;

        res.json({
          command: validCommand,
          results,
          summary: {
            total: results.length,
            success: successCount,
            failure: failureCount,
          },
          durationMs,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        log.error({ error, command: validCommand }, 'Failed to execute batch control command');

        res.status(500).json({
          error: 'Failed to execute batch control command',
          message: getErrorMessage(error),
        });
      }
    }
  );

  return router;
}
