/**
 * Management API Routes
 *
 * Handles sensor API key management and connectivity monitoring.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import dns from 'dns/promises';
import tls from 'tls';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { requireScope } from '../middleware/auth.js';

const execAsync = promisify(exec);

// =============================================================================
// Network Diagnostic Test Implementations
// =============================================================================

interface TestResult {
  testType: string;
  status: 'passed' | 'failed' | 'error';
  target: string;
  latencyMs: number | null;
  details: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

// Default test targets
const DEFAULT_TEST_TARGETS = {
  ping: '8.8.8.8',  // Google DNS
  dns: 'google.com',
  tls: 'google.com',
  traceroute: '8.8.8.8',
};

/**
 * Run a ping test using the system ping command
 */
async function runPingTest(target: string, logger: Logger): Promise<TestResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    // Use -c 3 for 3 packets, -W 5 for 5 second timeout (macOS/Linux compatible)
    const pingCmd = process.platform === 'win32'
      ? `ping -n 3 -w 5000 ${target}`
      : `ping -c 3 -W 5 ${target}`;

    const { stdout } = await execAsync(pingCmd, { timeout: 15000 });
    const latencyMs = Date.now() - startTime;

    // Parse ping output for statistics
    const avgMatch = stdout.match(/(?:avg|average)[^0-9]*([0-9.]+)/i);
    const lossMatch = stdout.match(/([0-9.]+)%\s*(?:packet\s*)?loss/i);
    const ttlMatch = stdout.match(/ttl[=:]?\s*([0-9]+)/i);

    const avgLatency = avgMatch ? parseFloat(avgMatch[1]) : null;
    const packetLoss = lossMatch ? parseFloat(lossMatch[1]) : 0;
    const ttl = ttlMatch ? parseInt(ttlMatch[1], 10) : null;

    return {
      testType: 'ping',
      status: packetLoss < 100 ? 'passed' : 'failed',
      target,
      latencyMs: avgLatency || latencyMs,
      details: {
        packetsTransmitted: 3,
        packetLoss: `${packetLoss}%`,
        avgRoundTrip: avgLatency ? `${avgLatency}ms` : 'N/A',
        ttl,
        rawOutput: stdout.slice(0, 500),
      },
      timestamp,
    };
  } catch (error: unknown) {
    const err = error as Error & { killed?: boolean; code?: number };
    logger.warn({ error: err.message, target }, 'Ping test failed');
    return {
      testType: 'ping',
      status: 'failed',
      target,
      latencyMs: null,
      details: {
        reason: err.killed ? 'timeout' : 'unreachable',
      },
      error: err.message,
      timestamp,
    };
  }
}

/**
 * Run a DNS resolution test
 */
async function runDnsTest(target: string, logger: Logger): Promise<TestResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    // Resolve A records (IPv4)
    const addresses = await dns.resolve4(target);
    const latencyMs = Date.now() - startTime;

    // Also try to get additional DNS info
    let mxRecords: Array<{ exchange: string; priority: number }> = [];
    let nsRecords: string[] = [];
    let txtRecords: string[][] = [];

    try {
      mxRecords = await dns.resolveMx(target);
    } catch { /* MX records optional */ }

    try {
      nsRecords = await dns.resolveNs(target);
    } catch { /* NS records optional */ }

    try {
      txtRecords = await dns.resolveTxt(target);
    } catch { /* TXT records optional */ }

    return {
      testType: 'dns',
      status: 'passed',
      target,
      latencyMs,
      details: {
        resolvedAddresses: addresses,
        recordCount: addresses.length,
        mxRecords: mxRecords.slice(0, 3).map(r => ({ exchange: r.exchange, priority: r.priority })),
        nsRecords: nsRecords.slice(0, 3),
        hasTxtRecords: txtRecords.length > 0,
      },
      timestamp,
    };
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    logger.warn({ error: err.message, target }, 'DNS test failed');
    return {
      testType: 'dns',
      status: 'failed',
      target,
      latencyMs: Date.now() - startTime,
      details: {
        errorCode: err.code || 'UNKNOWN',
        reason: err.code === 'ENOTFOUND' ? 'Domain not found' : 'Resolution failed',
      },
      error: err.message,
      timestamp,
    };
  }
}

/**
 * Run a TLS handshake test
 */
async function runTlsTest(target: string, logger: Logger): Promise<TestResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  return new Promise((resolve) => {
    const port = 443;
    const timeout = 10000;

    const socket = tls.connect(
      {
        host: target,
        port,
        servername: target,
        rejectUnauthorized: true,
        timeout,
      },
      () => {
        const latencyMs = Date.now() - startTime;
        const cert = socket.getPeerCertificate();
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol();

        const certDetails = {
          subject: cert.subject?.CN || 'Unknown',
          issuer: cert.issuer?.O || 'Unknown',
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          serialNumber: cert.serialNumber?.slice(0, 20),
          fingerprint: cert.fingerprint256?.slice(0, 32) + '...',
        };

        socket.end();

        resolve({
          testType: 'tls',
          status: 'passed',
          target: `${target}:${port}`,
          latencyMs,
          details: {
            protocol,
            cipher: cipher?.name || 'Unknown',
            cipherVersion: cipher?.version,
            certificate: certDetails,
            authorized: socket.authorized,
          },
          timestamp,
        });
      }
    );

    socket.on('error', (error: Error) => {
      logger.warn({ error: error.message, target }, 'TLS test failed');
      resolve({
        testType: 'tls',
        status: 'failed',
        target: `${target}:${port}`,
        latencyMs: Date.now() - startTime,
        details: {
          reason: error.message.includes('certificate') ? 'Certificate validation failed' : 'Connection failed',
        },
        error: error.message,
        timestamp,
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        testType: 'tls',
        status: 'failed',
        target: `${target}:${port}`,
        latencyMs: timeout,
        details: {
          reason: 'Connection timeout',
        },
        error: 'TLS handshake timed out',
        timestamp,
      });
    });
  });
}

/**
 * Run a traceroute test
 */
async function runTracerouteTest(target: string, logger: Logger): Promise<TestResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    // Use traceroute on Unix, tracert on Windows
    // Limit to 15 hops and 3 second timeout per hop
    const traceCmd = process.platform === 'win32'
      ? `tracert -h 15 -w 3000 ${target}`
      : `traceroute -m 15 -w 3 ${target}`;

    const { stdout } = await execAsync(traceCmd, { timeout: 60000 });
    const latencyMs = Date.now() - startTime;

    // Parse traceroute output to extract hops
    const lines = stdout.split('\n').filter(line => line.trim());
    const hops: Array<{ hop: number; host: string; ip: string | null; latency: string }> = [];

    for (const line of lines) {
      // Match hop patterns like "1  192.168.1.1 (192.168.1.1)  1.234 ms"
      const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
      if (hopMatch) {
        const hopNum = parseInt(hopMatch[1], 10);
        const rest = hopMatch[2];

        // Try to extract IP and latency
        const ipMatch = rest.match(/(\d+\.\d+\.\d+\.\d+)/);
        const latencyMatch = rest.match(/([0-9.]+)\s*ms/);
        const hostMatch = rest.match(/^([^\s(]+)/);

        if (hopNum > 0) {
          hops.push({
            hop: hopNum,
            host: hostMatch?.[1] || '*',
            ip: ipMatch?.[1] || null,
            latency: latencyMatch ? `${latencyMatch[1]}ms` : '*',
          });
        }
      }
    }

    const reachedTarget = hops.some(h => h.ip === target || h.host.includes(target));

    return {
      testType: 'traceroute',
      status: hops.length > 0 ? 'passed' : 'failed',
      target,
      latencyMs,
      details: {
        hopCount: hops.length,
        hops: hops.slice(0, 15),
        reachedTarget,
        rawOutput: stdout.slice(0, 1000),
      },
      timestamp,
    };
  } catch (error: unknown) {
    const err = error as Error & { killed?: boolean };
    logger.warn({ error: err.message, target }, 'Traceroute test failed');
    return {
      testType: 'traceroute',
      status: 'failed',
      target,
      latencyMs: Date.now() - startTime,
      details: {
        reason: err.killed ? 'timeout' : 'execution failed',
      },
      error: err.message,
      timestamp,
    };
  }
}

/**
 * Run a connectivity test by type
 */
async function runConnectivityTest(
  testType: string,
  target: string | undefined,
  logger: Logger
): Promise<TestResult> {
  const testTarget = target || DEFAULT_TEST_TARGETS[testType as keyof typeof DEFAULT_TEST_TARGETS] || '8.8.8.8';

  switch (testType) {
    case 'ping':
      return runPingTest(testTarget, logger);
    case 'dns':
      return runDnsTest(testTarget, logger);
    case 'tls':
      return runTlsTest(testTarget, logger);
    case 'traceroute':
      return runTracerouteTest(testTarget, logger);
    default:
      return {
        testType,
        status: 'error',
        target: testTarget,
        latencyMs: null,
        details: {},
        error: `Unknown test type: ${testType}`,
        timestamp: new Date().toISOString(),
      };
  }
}

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
   * POST /connectivity/test - Run network diagnostic tests
   *
   * Accepts testType: 'ping' | 'dns' | 'tls' | 'traceroute'
   * Optionally accepts target to test against (defaults to well-known endpoints)
   */
  router.post('/connectivity/test', requireScope('fleet:write'), async (req: Request, res: Response) => {
    try {
      const { testType, target } = req.body;

      // Validate test type
      const validTestTypes = ['ping', 'dns', 'tls', 'traceroute'];
      if (!testType || !validTestTypes.includes(testType)) {
        res.status(400).json({
          error: 'Invalid test type',
          validTypes: validTestTypes,
        });
        return;
      }

      // Validate target if provided (basic security check)
      if (target) {
        // Block private IP ranges and localhost
        const privateIpPatterns = [
          /^10\./,
          /^172\.(1[6-9]|2[0-9]|3[01])\./,
          /^192\.168\./,
          /^127\./,
          /^0\./,
          /^localhost$/i,
          /^::1$/,
          /^fe80:/i,
        ];

        const isPrivate = privateIpPatterns.some(pattern => pattern.test(target));
        if (isPrivate) {
          res.status(400).json({
            error: 'Testing private/local addresses is not allowed',
          });
          return;
        }

        // Basic hostname validation
        const validHostname = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(target) ||
                             /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
        if (!validHostname) {
          res.status(400).json({
            error: 'Invalid target hostname or IP address',
          });
          return;
        }
      }

      logger.info({ testType, target }, 'Running connectivity test');

      // Run the actual test
      const result = await runConnectivityTest(testType, target, logger);

      logger.info(
        { testType, target: result.target, status: result.status, latencyMs: result.latencyMs },
        'Connectivity test completed'
      );

      res.json({
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, 'Error running connectivity test');
      res.status(500).json({
        error: 'Failed to run connectivity test',
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
