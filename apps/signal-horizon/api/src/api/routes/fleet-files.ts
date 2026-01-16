/**
 * Fleet Files API Routes
 *
 * Secure file browsing and transfer endpoints for remote sensor management.
 * Provides read-only access to specific file paths on sensors through the
 * tunnel protocol.
 *
 * Security:
 * - All endpoints require `sensor:files` scope via RBAC
 * - File paths are validated against strict allowlists on the sensor side
 * - All access attempts are logged for audit purposes
 * - Progress tracking for large file transfers
 *
 * @module api/routes/fleet-files
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';
import { requireScope } from '../middleware/auth.js';
import { validateParams, validateQuery } from '../middleware/validation.js';
import { getErrorMessage } from '../../utils/errors.js';
import type { TunnelBroker } from '../../websocket/tunnel-broker.js';
import type {
  FileListMessage,
  FileListResponseMessage,
  FileReadMessage,
  FileReadChunkMessage,
  FileReadCompleteMessage,
  FileStatMessage,
  FileStatResponseMessage,
  FileErrorMessage,
  FileEntry,
  FilesMessage,
} from '../../types/tunnel.js';

// =============================================================================
// Constants
// =============================================================================

/** Default path for file browsing */
const DEFAULT_BROWSE_PATH = '/var/log/synapse';

/** Maximum timeout for file operations (60 seconds) */
const MAX_TIMEOUT_MS = 60_000;

/** Default timeout for file operations (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Maximum file size for direct download (10 MB) */
const MAX_DIRECT_DOWNLOAD_SIZE = 10 * 1024 * 1024;

// =============================================================================
// Validation Schemas
// =============================================================================

const SensorIdParamSchema = z.object({
  sensorId: z.string().min(1, 'Sensor ID is required'),
});

const ListFilesQuerySchema = z.object({
  path: z.string().default(DEFAULT_BROWSE_PATH),
  timeout: z.coerce.number().int().min(1000).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
});

const FileStatQuerySchema = z.object({
  path: z.string().min(1, 'Path is required'),
  includeChecksum: z.coerce.boolean().default(false),
  timeout: z.coerce.number().int().min(1000).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
});

const DownloadFileQuerySchema = z.object({
  path: z.string().min(1, 'Path is required'),
  timeout: z.coerce.number().int().min(1000).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
});

const DownloadChunkQuerySchema = z.object({
  path: z.string().min(1, 'Path is required'),
  offset: z.coerce.number().int().min(0).default(0),
  timeout: z.coerce.number().int().min(1000).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
});

// =============================================================================
// Types
// =============================================================================

/** File information returned from sensor (internal representation) */
interface FileInfo {
  path: string;
  name: string;
  size: number;
  modified: string;
  isDir: boolean;
  checksum?: string;
}

/** Directory listing response (internal representation) */
interface DirectoryListing {
  path: string;
  entries: FileInfo[];
  total: number;
  truncated: boolean;
}

/** File chunk for streaming transfer (internal representation) */
interface FileChunk {
  path: string;
  offset: number;
  data: string; // Base64 encoded
  isLast: boolean;
  sequence?: number;
}

/** Pending file request tracking */
interface PendingFileRequest {
  requestId: string;
  sensorId: string;
  operation: string;
  path: string;
  createdAt: number;
  timeout: number;
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * Convert FileEntry from tunnel protocol to internal FileInfo format.
 */
function fileEntryToInfo(entry: FileEntry, path: string): FileInfo {
  return {
    path,
    name: entry.name,
    size: entry.size,
    modified: new Date(entry.modifiedAt).toISOString(),
    isDir: entry.type === 'directory',
  };
}

// =============================================================================
// Audit Logging
// =============================================================================

interface FileAccessAuditEntry {
  timestamp: string;
  sensorId: string;
  tenantId: string;
  userId?: string;
  operation: 'list' | 'stat' | 'download' | 'chunk';
  path: string;
  success: boolean;
  errorCode?: string;
  fileSize?: number;
  durationMs?: number;
}

function logFileAccess(
  logger: Logger,
  entry: FileAccessAuditEntry
): void {
  const logMethod = entry.success ? logger.info.bind(logger) : logger.warn.bind(logger);
  logMethod(
    {
      audit: 'file_access',
      ...entry,
    },
    `File ${entry.operation}: ${entry.path} - ${entry.success ? 'success' : entry.errorCode}`
  );
}

// =============================================================================
// Route Factory
// =============================================================================

/**
 * Create fleet files API routes.
 *
 * @param prisma - Prisma client for database access
 * @param logger - Pino logger instance
 * @param options - Optional dependencies
 * @returns Express router with fleet files endpoints
 */
export function createFleetFilesRoutes(
  prisma: PrismaClient,
  logger: Logger,
  options: {
    tunnelBroker?: TunnelBroker;
  } = {}
): Router {
  const router = Router();
  const { tunnelBroker } = options;
  const log = logger.child({ component: 'fleet-files' });

  // Pending file requests (request ID -> request)
  const pendingRequests = new Map<string, PendingFileRequest>();

  // Progress tracking for active transfers
  const transferProgress = new Map<string, {
    requestId: string;
    sensorId: string;
    path: string;
    totalSize: number;
    transferred: number;
    startedAt: number;
  }>();

  // Set up tunnel message handler for file responses
  if (tunnelBroker) {
    tunnelBroker.onChannelMessage('files', async (_session, message) => {
      const fileMessage = message as FilesMessage;
      handleFileResponse(fileMessage);
    });
  }

  /**
   * Handle a file operation response from a sensor.
   */
  function handleFileResponse(response: FilesMessage): void {
    // Get requestId from message if available
    const requestId = 'requestId' in response ? response.requestId : undefined;
    if (!requestId) {
      log.warn({ type: response.type }, 'Received file message without requestId');
      return;
    }

    const request = pendingRequests.get(requestId);
    if (!request) {
      log.warn({ requestId }, 'Received response for unknown file request');
      return;
    }

    // Handle error responses
    if (response.type === 'error') {
      pendingRequests.delete(requestId);
      const errorResponse = response as FileErrorMessage;
      request.reject(new Error(`${errorResponse.code}: ${errorResponse.message}`));
      return;
    }

    // Handle successful responses based on type
    switch (response.type) {
      case 'list-response': {
        pendingRequests.delete(requestId);
        const listResponse = response as FileListResponseMessage;
        const listing: DirectoryListing = {
          path: listResponse.path,
          entries: listResponse.entries.map((e) => fileEntryToInfo(e, `${listResponse.path}/${e.name}`)),
          total: listResponse.totalCount,
          truncated: listResponse.truncated,
        };
        request.resolve(listing);
        break;
      }
      case 'stat-response': {
        pendingRequests.delete(requestId);
        const statResponse = response as FileStatResponseMessage;
        const info = fileEntryToInfo(statResponse.entry, statResponse.path);
        request.resolve(info);
        break;
      }
      case 'read-chunk': {
        // Don't delete request - more chunks may come
        const chunkResponse = response as FileReadChunkMessage;
        const chunk: FileChunk = {
          path: request.path,
          offset: chunkResponse.offset,
          data: chunkResponse.data,
          isLast: false,
          sequence: chunkResponse.chunkIndex,
        };
        request.resolve(chunk);
        break;
      }
      case 'read-complete': {
        pendingRequests.delete(requestId);
        const completeResponse = response as FileReadCompleteMessage;
        // For full file reads, signal completion
        request.resolve({
          path: request.path,
          totalBytes: completeResponse.totalBytes,
          checksum: completeResponse.checksum,
        });
        break;
      }
      default:
        log.warn({ type: response.type, requestId }, 'Unhandled file response type');
    }
  }

  /**
   * Send a file operation request to a sensor via the tunnel.
   */
  async function sendFileRequest<T>(
    sensorId: string,
    operation: 'list' | 'stat' | 'read' | 'chunk',
    path: string,
    timeout: number,
    params?: { offset?: number; includeChecksum?: boolean }
  ): Promise<T> {
    if (!tunnelBroker) {
      throw new Error('Tunnel broker not available');
    }

    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`File operation timed out after ${timeout}ms`));
      }, timeout);

      // Create pending request
      const request: PendingFileRequest = {
        requestId,
        sensorId,
        operation,
        path,
        createdAt: Date.now(),
        timeout,
        resolve: (data) => {
          clearTimeout(timeoutHandle);
          resolve(data as T);
        },
        reject: (error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
      };

      pendingRequests.set(requestId, request);

      // Build the appropriate message type based on operation
      let message: FileListMessage | FileStatMessage | FileReadMessage;
      const baseFields = {
        channel: 'files' as const,
        sessionId: requestId,
        sequenceId: 0,
        timestamp: Date.now(),
        path,
        requestId,
      };

      switch (operation) {
        case 'list':
          message = {
            ...baseFields,
            type: 'list',
          } satisfies FileListMessage;
          break;
        case 'stat':
          message = {
            ...baseFields,
            type: 'stat',
          } satisfies FileStatMessage;
          break;
        case 'read':
        case 'chunk':
          message = {
            ...baseFields,
            type: 'read',
            offset: params?.offset,
          } satisfies FileReadMessage;
          break;
        default:
          pendingRequests.delete(requestId);
          clearTimeout(timeoutHandle);
          reject(new Error(`Unknown operation: ${operation}`));
          return;
      }

      const sent = tunnelBroker.sendToSensor(sensorId, message);
      if (!sent) {
        pendingRequests.delete(requestId);
        clearTimeout(timeoutHandle);
        reject(new Error('Failed to send file request to sensor - tunnel not connected'));
      }
    });
  }

  /**
   * Verify sensor exists, belongs to tenant, and is online.
   */
  async function verifySensor(
    sensorId: string,
    tenantId: string
  ): Promise<{ id: string; name: string; tunnelActive: boolean } | null> {
    const sensor = await prisma.sensor.findFirst({
      where: { id: sensorId, tenantId },
      select: {
        id: true,
        name: true,
        connectionState: true,
        lastHeartbeat: true,
        tunnelActive: true,
      },
    });

    if (!sensor) {
      return null;
    }

    // Check if sensor is online (heartbeat within 2 minutes)
    const isOnline =
      sensor.lastHeartbeat &&
      Date.now() - new Date(sensor.lastHeartbeat).getTime() < 120_000 &&
      sensor.connectionState === 'CONNECTED';

    return isOnline ? sensor : null;
  }

  // ===========================================================================
  // Endpoints
  // ===========================================================================

  /**
   * GET /api/v1/fleet/:sensorId/files
   *
   * List files in a directory on the sensor.
   *
   * Query parameters:
   * - path: Directory path to list (default: /var/log/synapse)
   * - timeout: Request timeout in milliseconds (default: 30000)
   *
   * Requires: sensor:files scope
   *
   * @example
   * GET /api/v1/fleet/sensor-123/files?path=/var/log/synapse
   */
  router.get(
    '/:sensorId/files',
    requireScope('sensor:files'),
    validateParams(SensorIdParamSchema),
    validateQuery(ListFilesQuerySchema),
    async (req: Request, res: Response): Promise<void> => {
      const { sensorId } = req.params;
      const { path, timeout } = req.query as unknown as z.infer<typeof ListFilesQuerySchema>;
      const auth = req.auth!;
      const startTime = Date.now();

      try {
        // Verify sensor
        const sensor = await verifySensor(sensorId, auth.tenantId);
        if (!sensor) {
          logFileAccess(log, {
            timestamp: new Date().toISOString(),
            sensorId,
            tenantId: auth.tenantId,
            operation: 'list',
            path,
            success: false,
            errorCode: 'SENSOR_NOT_FOUND',
          });
          res.status(404).json({ error: 'Sensor not found or offline' });
          return;
        }

        // If tunnel is available and active, use it
        if (tunnelBroker && sensor.tunnelActive) {
          try {
            const listing = await sendFileRequest<DirectoryListing>(
              sensorId,
              'list',
              path,
              timeout
            );

            logFileAccess(log, {
              timestamp: new Date().toISOString(),
              sensorId,
              tenantId: auth.tenantId,
              operation: 'list',
              path,
              success: true,
              durationMs: Date.now() - startTime,
            });

            res.json({
              sensorId,
              sensorName: sensor.name,
              ...listing,
            });
            return;
          } catch (error) {
            log.warn({ error, sensorId, path }, 'Failed to list files via tunnel, returning error');

            logFileAccess(log, {
              timestamp: new Date().toISOString(),
              sensorId,
              tenantId: auth.tenantId,
              operation: 'list',
              path,
              success: false,
              errorCode: 'TUNNEL_ERROR',
              durationMs: Date.now() - startTime,
            });

            res.status(502).json({
              error: 'Failed to list files',
              message: getErrorMessage(error),
            });
            return;
          }
        }

        // Tunnel not available
        res.status(503).json({
          error: 'Tunnel not available',
          message: 'Sensor tunnel connection is not active',
        });
      } catch (error) {
        log.error({ error, sensorId, path }, 'Failed to list files');
        res.status(500).json({
          error: 'Failed to list files',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/fleet/:sensorId/files/stat
   *
   * Get information about a specific file.
   *
   * Query parameters:
   * - path: File path to stat (required)
   * - includeChecksum: Include SHA-256 checksum (default: false)
   * - timeout: Request timeout in milliseconds (default: 30000)
   *
   * Requires: sensor:files scope
   *
   * @example
   * GET /api/v1/fleet/sensor-123/files/stat?path=/var/log/synapse/access.log&includeChecksum=true
   */
  router.get(
    '/:sensorId/files/stat',
    requireScope('sensor:files'),
    validateParams(SensorIdParamSchema),
    validateQuery(FileStatQuerySchema),
    async (req: Request, res: Response): Promise<void> => {
      const { sensorId } = req.params;
      const { path, includeChecksum, timeout } = req.query as unknown as z.infer<typeof FileStatQuerySchema>;
      const auth = req.auth!;
      const startTime = Date.now();

      try {
        // Verify sensor
        const sensor = await verifySensor(sensorId, auth.tenantId);
        if (!sensor) {
          res.status(404).json({ error: 'Sensor not found or offline' });
          return;
        }

        if (tunnelBroker && sensor.tunnelActive) {
          try {
            const fileInfo = await sendFileRequest<FileInfo>(
              sensorId,
              'stat',
              path,
              timeout,
              { includeChecksum }
            );

            logFileAccess(log, {
              timestamp: new Date().toISOString(),
              sensorId,
              tenantId: auth.tenantId,
              operation: 'stat',
              path,
              success: true,
              fileSize: fileInfo.size,
              durationMs: Date.now() - startTime,
            });

            res.json({
              sensorId,
              sensorName: sensor.name,
              file: fileInfo,
            });
            return;
          } catch (error) {
            logFileAccess(log, {
              timestamp: new Date().toISOString(),
              sensorId,
              tenantId: auth.tenantId,
              operation: 'stat',
              path,
              success: false,
              errorCode: 'TUNNEL_ERROR',
              durationMs: Date.now() - startTime,
            });

            res.status(502).json({
              error: 'Failed to stat file',
              message: getErrorMessage(error),
            });
            return;
          }
        }

        res.status(503).json({
          error: 'Tunnel not available',
          message: 'Sensor tunnel connection is not active',
        });
      } catch (error) {
        log.error({ error, sensorId, path }, 'Failed to stat file');
        res.status(500).json({
          error: 'Failed to stat file',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/fleet/:sensorId/files/download
   *
   * Download a file from the sensor.
   * Streams the file in chunks for large files.
   *
   * Query parameters:
   * - path: File path to download (required)
   * - timeout: Request timeout in milliseconds (default: 30000)
   *
   * Response headers:
   * - Content-Disposition: attachment with filename
   * - Content-Type: application/octet-stream
   * - X-Checksum: SHA-256 checksum of the file
   * - X-File-Size: Original file size in bytes
   *
   * Requires: sensor:files scope
   *
   * @example
   * GET /api/v1/fleet/sensor-123/files/download?path=/var/log/synapse/access.log
   */
  router.get(
    '/:sensorId/files/download',
    requireScope('sensor:files'),
    validateParams(SensorIdParamSchema),
    validateQuery(DownloadFileQuerySchema),
    async (req: Request, res: Response): Promise<void> => {
      const { sensorId } = req.params;
      const { path, timeout } = req.query as unknown as z.infer<typeof DownloadFileQuerySchema>;
      const auth = req.auth!;
      const startTime = Date.now();

      try {
        // Verify sensor
        const sensor = await verifySensor(sensorId, auth.tenantId);
        if (!sensor) {
          res.status(404).json({ error: 'Sensor not found or offline' });
          return;
        }

        if (!tunnelBroker || !sensor.tunnelActive) {
          res.status(503).json({
            error: 'Tunnel not available',
            message: 'Sensor tunnel connection is not active',
          });
          return;
        }

        try {
          // First, get file info to know the size
          const fileInfo = await sendFileRequest<FileInfo>(
            sensorId,
            'stat',
            path,
            timeout,
            { includeChecksum: true }
          );

          if (fileInfo.isDir) {
            res.status(400).json({
              error: 'Cannot download directory',
              message: 'Use list endpoint for directories',
            });
            return;
          }

          // Extract filename from path
          const filename = path.split('/').pop() ?? 'download';

          // Set response headers
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('X-File-Size', fileInfo.size.toString());
          if (fileInfo.checksum) {
            res.setHeader('X-Checksum', fileInfo.checksum);
          }

          // For small files, download directly
          if (fileInfo.size <= MAX_DIRECT_DOWNLOAD_SIZE) {
            const response = await sendFileRequest<{ contents: string }>(
              sensorId,
              'read',
              path,
              timeout
            );

            // Decode base64 and send
            const buffer = Buffer.from(response.contents, 'base64');
            res.setHeader('Content-Length', buffer.length.toString());

            logFileAccess(log, {
              timestamp: new Date().toISOString(),
              sensorId,
              tenantId: auth.tenantId,
              operation: 'download',
              path,
              success: true,
              fileSize: buffer.length,
              durationMs: Date.now() - startTime,
            });

            res.send(buffer);
            return;
          }

          // For large files, stream chunks
          // Track transfer progress
          const transferId = randomUUID();
          transferProgress.set(transferId, {
            requestId: transferId,
            sensorId,
            path,
            totalSize: fileInfo.size,
            transferred: 0,
            startedAt: Date.now(),
          });

          res.setHeader('Content-Length', fileInfo.size.toString());

          // Stream chunks
          let offset = 0;
          let isComplete = false;

          while (!isComplete) {
            const chunk = await sendFileRequest<FileChunk>(
              sensorId,
              'chunk',
              path,
              timeout,
              { offset }
            );

            // Decode and write chunk
            const buffer = Buffer.from(chunk.data, 'base64');
            res.write(buffer);

            offset += buffer.length;
            isComplete = chunk.isLast;

            // Update progress
            const progress = transferProgress.get(transferId);
            if (progress) {
              progress.transferred = offset;
            }
          }

          // Clean up progress tracking
          transferProgress.delete(transferId);

          logFileAccess(log, {
            timestamp: new Date().toISOString(),
            sensorId,
            tenantId: auth.tenantId,
            operation: 'download',
            path,
            success: true,
            fileSize: offset,
            durationMs: Date.now() - startTime,
          });

          res.end();
        } catch (error) {
          logFileAccess(log, {
            timestamp: new Date().toISOString(),
            sensorId,
            tenantId: auth.tenantId,
            operation: 'download',
            path,
            success: false,
            errorCode: 'DOWNLOAD_ERROR',
            durationMs: Date.now() - startTime,
          });

          // If headers already sent, we can't send JSON error
          if (res.headersSent) {
            res.end();
            log.error({ error, sensorId, path }, 'Download failed after headers sent');
          } else {
            res.status(502).json({
              error: 'Failed to download file',
              message: getErrorMessage(error),
            });
          }
        }
      } catch (error) {
        log.error({ error, sensorId, path }, 'Failed to download file');
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to download file',
            message: getErrorMessage(error),
          });
        }
      }
    }
  );

  /**
   * GET /api/v1/fleet/:sensorId/files/download-chunk
   *
   * Download a single chunk of a file.
   * Useful for resumable downloads or random access.
   *
   * Query parameters:
   * - path: File path (required)
   * - offset: Byte offset to start reading from (default: 0)
   * - timeout: Request timeout in milliseconds (default: 30000)
   *
   * Response:
   * - JSON object with chunk data (base64 encoded)
   *
   * Requires: sensor:files scope
   *
   * @example
   * GET /api/v1/fleet/sensor-123/files/download-chunk?path=/var/log/synapse/access.log&offset=65536
   */
  router.get(
    '/:sensorId/files/download-chunk',
    requireScope('sensor:files'),
    validateParams(SensorIdParamSchema),
    validateQuery(DownloadChunkQuerySchema),
    async (req: Request, res: Response): Promise<void> => {
      const { sensorId } = req.params;
      const { path, offset, timeout } = req.query as unknown as z.infer<typeof DownloadChunkQuerySchema>;
      const auth = req.auth!;
      const startTime = Date.now();

      try {
        // Verify sensor
        const sensor = await verifySensor(sensorId, auth.tenantId);
        if (!sensor) {
          res.status(404).json({ error: 'Sensor not found or offline' });
          return;
        }

        if (!tunnelBroker || !sensor.tunnelActive) {
          res.status(503).json({
            error: 'Tunnel not available',
            message: 'Sensor tunnel connection is not active',
          });
          return;
        }

        try {
          const chunk = await sendFileRequest<FileChunk>(
            sensorId,
            'chunk',
            path,
            timeout,
            { offset }
          );

          logFileAccess(log, {
            timestamp: new Date().toISOString(),
            sensorId,
            tenantId: auth.tenantId,
            operation: 'chunk',
            path,
            success: true,
            durationMs: Date.now() - startTime,
          });

          res.json({
            sensorId,
            sensorName: sensor.name,
            chunk,
          });
        } catch (error) {
          logFileAccess(log, {
            timestamp: new Date().toISOString(),
            sensorId,
            tenantId: auth.tenantId,
            operation: 'chunk',
            path,
            success: false,
            errorCode: 'CHUNK_ERROR',
            durationMs: Date.now() - startTime,
          });

          res.status(502).json({
            error: 'Failed to download chunk',
            message: getErrorMessage(error),
          });
        }
      } catch (error) {
        log.error({ error, sensorId, path, offset }, 'Failed to download chunk');
        res.status(500).json({
          error: 'Failed to download chunk',
          message: getErrorMessage(error),
        });
      }
    }
  );

  /**
   * GET /api/v1/fleet/:sensorId/files/progress/:transferId
   *
   * Get progress of an active file transfer.
   *
   * Requires: sensor:files scope
   */
  router.get(
    '/:sensorId/files/progress/:transferId',
    requireScope('sensor:files'),
    async (req: Request, res: Response): Promise<void> => {
      const { sensorId, transferId } = req.params;
      const auth = req.auth!;

      try {
        // Verify sensor belongs to tenant
        const sensor = await prisma.sensor.findFirst({
          where: { id: sensorId, tenantId: auth.tenantId },
          select: { id: true },
        });

        if (!sensor) {
          res.status(404).json({ error: 'Sensor not found' });
          return;
        }

        const progress = transferProgress.get(transferId);
        if (!progress || progress.sensorId !== sensorId) {
          res.status(404).json({ error: 'Transfer not found' });
          return;
        }

        const elapsedMs = Date.now() - progress.startedAt;
        const bytesPerSecond = elapsedMs > 0 ? (progress.transferred / elapsedMs) * 1000 : 0;
        const remainingBytes = progress.totalSize - progress.transferred;
        const estimatedSecondsRemaining = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : 0;

        res.json({
          transferId,
          sensorId,
          path: progress.path,
          totalSize: progress.totalSize,
          transferred: progress.transferred,
          percentage: Math.round((progress.transferred / progress.totalSize) * 100),
          bytesPerSecond: Math.round(bytesPerSecond),
          estimatedSecondsRemaining: Math.round(estimatedSecondsRemaining),
          elapsedMs,
        });
      } catch (error) {
        log.error({ error, sensorId, transferId }, 'Failed to get transfer progress');
        res.status(500).json({
          error: 'Failed to get transfer progress',
          message: getErrorMessage(error),
        });
      }
    }
  );

  return router;
}

export default createFleetFilesRoutes;
