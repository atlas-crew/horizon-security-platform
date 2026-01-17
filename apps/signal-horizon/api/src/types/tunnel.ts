/**
 * Tunnel Protocol Types for Remote Management
 *
 * WebSocket message types for remote sensor management in the Signal Horizon
 * platform. This module defines the complete tunnel protocol for:
 *
 * - **Shell**: Remote terminal access with PTY support
 * - **Logs**: Real-time log streaming with filtering
 * - **Diag**: Diagnostics collection (health, memory, connections, rules, actors)
 * - **Control**: Service control operations (reload, restart, shutdown, drain, resume)
 * - **Files**: Secure file transfer and browsing
 *
 * All messages use channel-based routing with session isolation for
 * multi-tenant security and resource management.
 *
 * @module tunnel
 */

// =============================================================================
// Tunnel Channel Types
// =============================================================================

/**
 * Available tunnel channels for remote management.
 * Each channel has specific security requirements and rate limits.
 */
export type TunnelChannel =
  | 'shell'    // Remote terminal (requires elevated permissions)
  | 'logs'     // Log streaming
  | 'diag'     // Diagnostics collection
  | 'control'  // Service control operations
  | 'files'    // File transfer
  | 'update';  // Firmware updates

/**
 * Session lifecycle states for tunnel channels.
 * Used for connection management and cleanup.
 */
export type TunnelSessionState =
  | 'starting'   // Session initialization in progress
  | 'active'     // Session is active and accepting messages
  | 'closing'    // Graceful shutdown initiated
  | 'closed'     // Session terminated
  | 'error';     // Session in error state

// =============================================================================
// Base Types
// =============================================================================

/**
 * Base tunnel message with channel routing information.
 * All tunnel messages extend this interface.
 *
 * @example
 * ```typescript
 * const msg: TunnelMessageBase = {
 *   channel: 'shell',
 *   sessionId: 'sess-abc123',
 *   sequenceId: 42,
 *   timestamp: Date.now()
 * };
 * ```
 */
export interface TunnelMessageBase {
  /** Channel for message routing */
  channel: TunnelChannel;
  /** Unique session identifier for this tunnel connection */
  sessionId: string;
  /** Monotonically increasing sequence ID for ordering and deduplication */
  sequenceId: number;
  /** Unix timestamp in milliseconds when message was created */
  timestamp: number;
}

// =============================================================================
// Shell Channel Messages
// =============================================================================

/**
 * Shell data message containing terminal I/O.
 * Data is base64 encoded to handle binary content safely.
 *
 * Max size: 64KB per message (65536 bytes before encoding)
 */
export interface ShellDataMessage extends TunnelMessageBase {
  channel: 'shell';
  type: 'data';
  /** Base64 encoded terminal data */
  data: string;
}

/**
 * Shell resize message for PTY dimension updates.
 * Sent when the client terminal is resized.
 */
export interface ShellResizeMessage extends TunnelMessageBase {
  channel: 'shell';
  type: 'resize';
  /** Number of columns (characters per line) */
  cols: number;
  /** Number of rows (lines visible) */
  rows: number;
}

/**
 * Shell exit message indicating process termination.
 * Sent when the remote shell process exits.
 */
export interface ShellExitMessage extends TunnelMessageBase {
  channel: 'shell';
  type: 'exit';
  /** Process exit code (0 = success) */
  code: number;
  /** Optional signal that caused termination */
  signal?: string;
}

/**
 * Shell start request to initiate a remote terminal session.
 * Requires elevated permissions on the sensor.
 */
export interface ShellStartMessage extends TunnelMessageBase {
  channel: 'shell';
  type: 'start';
  /** Initial terminal columns */
  cols: number;
  /** Initial terminal rows */
  rows: number;
  /** Optional shell to use (defaults to sensor default) */
  shell?: string;
  /** Optional environment variables to set */
  env?: Record<string, string>;
}

/**
 * Shell started confirmation from the sensor.
 * Indicates the remote shell is ready to accept input.
 */
export interface ShellStartedMessage extends TunnelMessageBase {
  channel: 'shell';
  type: 'started';
  /** Process ID of the shell on the sensor */
  pid: number;
  /** Actual shell being used */
  shell: string;
}

/**
 * Shell error message for channel-specific errors.
 */
export interface ShellErrorMessage extends TunnelMessageBase {
  channel: 'shell';
  type: 'error';
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Union of all shell channel message types.
 */
export type ShellMessage =
  | ShellDataMessage
  | ShellResizeMessage
  | ShellExitMessage
  | ShellStartMessage
  | ShellStartedMessage
  | ShellErrorMessage;

// =============================================================================
// Logs Channel Messages
// =============================================================================

/**
 * Log sources available for streaming.
 */
export type LogSource =
  | 'system'     // System/OS logs
  | 'sensor'     // Sensor application logs
  | 'access'     // HTTP access logs
  | 'error'      // Error logs
  | 'audit'      // Audit trail logs
  | 'security';  // Security event logs

/**
 * Log severity levels.
 */
export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal';

/**
 * Filter criteria for log subscription.
 */
export interface LogFilter {
  /** Minimum log level to include */
  minLevel?: LogLevel;
  /** Text pattern to match (case-insensitive) */
  pattern?: string;
  /** Regular expression pattern to match */
  regex?: string;
  /** Only include logs from specific components */
  components?: string[];
  /** Start time for log range (Unix timestamp ms) */
  since?: number;
  /** End time for log range (Unix timestamp ms) */
  until?: number;
}

/**
 * Log subscription request to start receiving log entries.
 */
export interface LogSubscribeMessage extends TunnelMessageBase {
  channel: 'logs';
  type: 'subscribe';
  /** Log sources to subscribe to */
  sources: LogSource[];
  /** Optional filter criteria */
  filter?: LogFilter;
  /** Include backfill of recent logs */
  backfill?: boolean;
  /** Number of lines to backfill (max 1000, default 100) */
  backfillLines?: number;
}

/**
 * Log unsubscribe request to stop receiving logs from specific sources.
 */
export interface LogUnsubscribeMessage extends TunnelMessageBase {
  channel: 'logs';
  type: 'unsubscribe';
  /** Log sources to unsubscribe from (empty = all) */
  sources?: LogSource[];
}

/**
 * Individual log entry pushed to the client.
 */
export interface LogEntryMessage extends TunnelMessageBase {
  channel: 'logs';
  type: 'entry';
  /** Source of the log entry */
  source: LogSource;
  /** Severity level */
  level: LogLevel;
  /** Log message text */
  message: string;
  /** Structured fields from the log entry */
  fields?: Record<string, unknown>;
  /** Original timestamp from the log source (Unix timestamp ms) */
  logTimestamp: number;
  /** Component that generated the log */
  component?: string;
}

/**
 * Log backfill complete notification.
 * Sent after all historical logs have been delivered.
 */
export interface LogBackfillMessage extends TunnelMessageBase {
  channel: 'logs';
  type: 'backfill-complete';
  /** Number of entries backfilled */
  count: number;
  /** Sources that were backfilled */
  sources: LogSource[];
}

/**
 * Log channel error message.
 */
export interface LogErrorMessage extends TunnelMessageBase {
  channel: 'logs';
  type: 'error';
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Union of all logs channel message types.
 */
export type LogsMessage =
  | LogSubscribeMessage
  | LogUnsubscribeMessage
  | LogEntryMessage
  | LogBackfillMessage
  | LogErrorMessage;

// =============================================================================
// Diagnostics Channel Messages
// =============================================================================

/**
 * Types of diagnostic information that can be requested.
 */
export type DiagnosticType =
  | 'health'       // Overall health status
  | 'memory'       // Memory usage details
  | 'connections'  // Active connection information
  | 'rules'        // Loaded rules and their state
  | 'actors'       // Threat actor information
  | 'config'       // Current configuration
  | 'metrics'      // Performance metrics snapshot
  | 'threads'      // Thread pool status
  | 'cache';       // Cache statistics

/**
 * Diagnostic request message to query sensor state.
 */
export interface DiagRequestMessage extends TunnelMessageBase {
  channel: 'diag';
  type: 'request';
  /** Type of diagnostic information requested */
  diagType: DiagnosticType;
  /** Optional parameters for the diagnostic query */
  params?: Record<string, unknown>;
  /** Request ID for response correlation */
  requestId: string;
}

/**
 * Health diagnostic response payload.
 */
export interface HealthDiagnostic {
  diagType: 'health';
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  components: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
  }>;
}

/**
 * Memory diagnostic response payload.
 */
export interface MemoryDiagnostic {
  diagType: 'memory';
  heapUsed: number;
  heapTotal: number;
  heapLimit: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  gcStats?: {
    collections: number;
    pauseMs: number;
  };
}

/**
 * Connections diagnostic response payload.
 */
export interface ConnectionsDiagnostic {
  diagType: 'connections';
  activeConnections: number;
  maxConnections: number;
  connectionsByType: Record<string, number>;
  recentConnections: Array<{
    id: string;
    remoteAddr: string;
    connectedAt: number;
    bytesIn: number;
    bytesOut: number;
  }>;
}

/**
 * Rules diagnostic response payload.
 */
export interface RulesDiagnostic {
  diagType: 'rules';
  totalRules: number;
  enabledRules: number;
  disabledRules: number;
  rulesByCategory: Record<string, number>;
  lastUpdated: number;
  rulesHash: string;
  topTriggeredRules: Array<{
    id: string;
    name: string;
    triggerCount: number;
    lastTriggered: number;
  }>;
}

/**
 * Actors diagnostic response payload.
 */
export interface ActorsDiagnostic {
  diagType: 'actors';
  trackedActors: number;
  blockedActors: number;
  actorsByType: Record<string, number>;
  topActors: Array<{
    id: string;
    type: string;
    riskScore: number;
    hitCount: number;
    lastSeen: number;
  }>;
}

/**
 * Config diagnostic response payload.
 */
export interface ConfigDiagnostic {
  diagType: 'config';
  configHash: string;
  lastUpdated: number;
  settings: Record<string, unknown>;
}

/**
 * Metrics diagnostic response payload.
 */
export interface MetricsDiagnostic {
  diagType: 'metrics';
  requestsTotal: number;
  requestsPerSecond: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorsTotal: number;
  errorRate: number;
  bytesIn: number;
  bytesOut: number;
}

/**
 * Threads diagnostic response payload.
 */
export interface ThreadsDiagnostic {
  diagType: 'threads';
  workerThreads: number;
  activeThreads: number;
  pendingTasks: number;
  completedTasks: number;
  threadPool: Array<{
    id: number;
    state: 'idle' | 'busy' | 'blocked';
    currentTask?: string;
  }>;
}

/**
 * Cache diagnostic response payload.
 */
export interface CacheDiagnostic {
  diagType: 'cache';
  caches: Array<{
    name: string;
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
  }>;
}

/**
 * Union of all diagnostic payloads.
 */
export type DiagnosticPayload =
  | HealthDiagnostic
  | MemoryDiagnostic
  | ConnectionsDiagnostic
  | RulesDiagnostic
  | ActorsDiagnostic
  | ConfigDiagnostic
  | MetricsDiagnostic
  | ThreadsDiagnostic
  | CacheDiagnostic;

/**
 * Diagnostic response message with collected data.
 */
export interface DiagResponseMessage extends TunnelMessageBase {
  channel: 'diag';
  type: 'response';
  /** Request ID for correlation */
  requestId: string;
  /** Diagnostic data payload */
  data: DiagnosticPayload;
  /** Time taken to collect diagnostic (ms) */
  collectionTimeMs: number;
}

/**
 * Diagnostic error message.
 */
export interface DiagErrorMessage extends TunnelMessageBase {
  channel: 'diag';
  type: 'error';
  /** Request ID for correlation */
  requestId: string;
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Union of all diagnostics channel message types.
 */
export type DiagMessage =
  | DiagRequestMessage
  | DiagResponseMessage
  | DiagErrorMessage;

// =============================================================================
// Control Channel Messages
// =============================================================================

/**
 * Service control operation types.
 */
export type ControlOperation =
  | 'reload'    // Reload configuration without restart
  | 'restart'   // Full service restart
  | 'shutdown'  // Graceful shutdown
  | 'drain'     // Stop accepting new connections, finish existing
  | 'resume';   // Resume after drain

/**
 * Control request message to execute a service operation.
 * Requires elevated permissions.
 */
export interface ControlRequestMessage extends TunnelMessageBase {
  channel: 'control';
  type: 'request';
  /** Operation to perform */
  operation: ControlOperation;
  /** Request ID for acknowledgment correlation */
  requestId: string;
  /** Optional parameters for the operation */
  params?: {
    /** Timeout for operation (ms) */
    timeoutMs?: number;
    /** Force operation even if checks fail */
    force?: boolean;
    /** Graceful wait time for drain (ms) */
    gracePeriodMs?: number;
  };
}

/**
 * Control acknowledgment message confirming operation receipt.
 */
export interface ControlAckMessage extends TunnelMessageBase {
  channel: 'control';
  type: 'ack';
  /** Request ID being acknowledged */
  requestId: string;
  /** Whether the operation was accepted */
  accepted: boolean;
  /** Reason if not accepted */
  reason?: string;
}

/**
 * Control progress message for long-running operations.
 */
export interface ControlProgressMessage extends TunnelMessageBase {
  channel: 'control';
  type: 'progress';
  /** Request ID for correlation */
  requestId: string;
  /** Current operation phase */
  phase: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Human-readable status message */
  message?: string;
}

/**
 * Control complete message when operation finishes.
 */
export interface ControlCompleteMessage extends TunnelMessageBase {
  channel: 'control';
  type: 'complete';
  /** Request ID for correlation */
  requestId: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable result message */
  message?: string;
  /** Operation-specific result data */
  result?: Record<string, unknown>;
}

/**
 * Control error message for operation failures.
 */
export interface ControlErrorMessage extends TunnelMessageBase {
  channel: 'control';
  type: 'error';
  /** Request ID for correlation */
  requestId: string;
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Union of all control channel message types.
 */
export type ControlMessage =
  | ControlRequestMessage
  | ControlAckMessage
  | ControlProgressMessage
  | ControlCompleteMessage
  | ControlErrorMessage;

// =============================================================================
// Files Channel Messages
// =============================================================================

/**
 * File type indicator.
 */
export type FileType = 'file' | 'directory' | 'symlink' | 'unknown';

/**
 * File entry information for directory listings.
 */
export interface FileEntry {
  /** File name (not full path) */
  name: string;
  /** File type */
  type: FileType;
  /** File size in bytes (0 for directories) */
  size: number;
  /** Last modified timestamp (Unix ms) */
  modifiedAt: number;
  /** Unix permissions (octal string, e.g., "0644") */
  permissions: string;
  /** Owner user name */
  owner?: string;
  /** Owner group name */
  group?: string;
  /** Symlink target if type is 'symlink' */
  linkTarget?: string;
}

/**
 * File list request to browse a directory.
 */
export interface FileListMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'list';
  /** Directory path to list */
  path: string;
  /** Request ID for response correlation */
  requestId: string;
  /** Include hidden files (starting with .) */
  includeHidden?: boolean;
}

/**
 * File list response with directory contents.
 */
export interface FileListResponseMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'list-response';
  /** Request ID for correlation */
  requestId: string;
  /** Absolute path that was listed */
  path: string;
  /** Directory entries */
  entries: FileEntry[];
  /** Total number of entries (may differ from entries.length if truncated) */
  totalCount: number;
  /** Whether the list was truncated */
  truncated: boolean;
}

/**
 * File read request to download a file.
 * Large files are streamed in chunks.
 */
export interface FileReadMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'read';
  /** File path to read */
  path: string;
  /** Request ID for response correlation */
  requestId: string;
  /** Optional start offset for partial read */
  offset?: number;
  /** Optional length limit */
  length?: number;
}

/**
 * File read chunk containing file data.
 * Files are streamed in 64KB chunks.
 */
export interface FileReadChunkMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'read-chunk';
  /** Request ID for correlation */
  requestId: string;
  /** Chunk sequence number (0-indexed) */
  chunkIndex: number;
  /** Base64 encoded file data */
  data: string;
  /** Byte offset this chunk starts at */
  offset: number;
}

/**
 * File read complete notification.
 */
export interface FileReadCompleteMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'read-complete';
  /** Request ID for correlation */
  requestId: string;
  /** Total bytes transferred */
  totalBytes: number;
  /** Total chunks sent */
  totalChunks: number;
  /** SHA-256 checksum of the file */
  checksum: string;
}

/**
 * File write request to upload a file.
 * Initiates a chunked upload session.
 */
export interface FileWriteMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'write';
  /** Destination file path */
  path: string;
  /** Request ID for response correlation */
  requestId: string;
  /** Total file size in bytes */
  totalSize: number;
  /** Expected SHA-256 checksum for verification */
  checksum: string;
  /** Whether to overwrite existing file */
  overwrite?: boolean;
}

/**
 * File write chunk containing upload data.
 */
export interface FileWriteChunkMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'write-chunk';
  /** Request ID for correlation */
  requestId: string;
  /** Chunk sequence number (0-indexed) */
  chunkIndex: number;
  /** Base64 encoded file data */
  data: string;
  /** Whether this is the final chunk */
  final: boolean;
}

/**
 * File write acknowledgment for each chunk.
 */
export interface FileWriteAckMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'write-ack';
  /** Request ID for correlation */
  requestId: string;
  /** Chunk index that was acknowledged */
  chunkIndex: number;
  /** Bytes written so far */
  bytesWritten: number;
}

/**
 * File write complete notification.
 */
export interface FileWriteCompleteMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'write-complete';
  /** Request ID for correlation */
  requestId: string;
  /** Total bytes written */
  totalBytes: number;
  /** Final file path (may differ if renamed) */
  path: string;
}

/**
 * File stat request to get file metadata.
 */
export interface FileStatMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'stat';
  /** File path to stat */
  path: string;
  /** Request ID for response correlation */
  requestId: string;
}

/**
 * File stat response with metadata.
 */
export interface FileStatResponseMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'stat-response';
  /** Request ID for correlation */
  requestId: string;
  /** File path */
  path: string;
  /** File metadata */
  entry: FileEntry;
}

/**
 * File channel error message.
 */
export interface FileErrorMessage extends TunnelMessageBase {
  channel: 'files';
  type: 'error';
  /** Request ID for correlation (if applicable) */
  requestId?: string;
  /** Error code (e.g., 'ENOENT', 'EACCES', 'EISDIR') */
  code: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Union of all files channel message types.
 */
export type FilesMessage =
  | FileListMessage
  | FileListResponseMessage
  | FileReadMessage
  | FileReadChunkMessage
  | FileReadCompleteMessage
  | FileWriteMessage
  | FileWriteChunkMessage
  | FileWriteAckMessage
  | FileWriteCompleteMessage
  | FileStatMessage
  | FileStatResponseMessage
  | FileErrorMessage;

// =============================================================================
// Update Channel Messages
// =============================================================================

/**
 * Update download request.
 */
export interface UpdateDownloadMessage extends TunnelMessageBase {
  channel: 'update';
  type: 'download';
  requestId: string;
  release: {
    version: string;
    changelog: string;
    binary_url: string;
    sha256: string;
    size: number;
    released_at: string;
  };
}

/**
 * Update progress message.
 */
export interface UpdateProgressMessage extends TunnelMessageBase {
  channel: 'update';
  type: 'progress';
  requestId: string;
  stage: 'downloading' | 'verifying' | 'installing' | 'restarting';
  progress: number;
  message?: string;
}

/**
 * Update result message.
 */
export interface UpdateResultMessage extends TunnelMessageBase {
  channel: 'update';
  type: 'result';
  requestId: string;
  success: boolean;
  error?: string;
}

/**
 * Update error message.
 */
export interface UpdateErrorMessage extends TunnelMessageBase {
  channel: 'update';
  type: 'error';
  requestId: string;
  code: string;
  message: string;
}

export type UpdateMessage =
  | UpdateDownloadMessage
  | UpdateProgressMessage
  | UpdateResultMessage
  | UpdateErrorMessage;

// =============================================================================
// Session Management Messages
// =============================================================================

/**
 * Session open request to establish a tunnel channel.
 */
export interface SessionOpenMessage {
  type: 'session-open';
  channel: TunnelChannel;
  /** Optional session ID (server will assign if not provided) */
  sessionId?: string;
  /** Authentication token for this session */
  authToken: string;
  /** Timestamp when request was created */
  timestamp: number;
}

/**
 * Session opened confirmation.
 */
export interface SessionOpenedMessage {
  type: 'session-opened';
  channel: TunnelChannel;
  /** Assigned session ID */
  sessionId: string;
  /** Session capabilities */
  capabilities: string[];
  /** Server timestamp */
  timestamp: number;
}

/**
 * Session close request to terminate a tunnel channel.
 */
export interface SessionCloseMessage {
  type: 'session-close';
  channel: TunnelChannel;
  sessionId: string;
  /** Reason for closing */
  reason?: string;
  timestamp: number;
}

/**
 * Session closed confirmation.
 */
export interface SessionClosedMessage {
  type: 'session-closed';
  channel: TunnelChannel;
  sessionId: string;
  /** Final status */
  status: 'normal' | 'timeout' | 'error' | 'forced';
  /** Reason for closure */
  reason?: string;
  timestamp: number;
}

/**
 * Session error for session-level failures.
 */
export interface SessionErrorMessage {
  type: 'session-error';
  channel?: TunnelChannel;
  sessionId?: string;
  code: string;
  message: string;
  timestamp: number;
}

/**
 * Union of session management messages.
 */
export type SessionMessage =
  | SessionOpenMessage
  | SessionOpenedMessage
  | SessionCloseMessage
  | SessionClosedMessage
  | SessionErrorMessage;

// =============================================================================
// Master Tunnel Message Union
// =============================================================================

/**
 * Union of all tunnel message types.
 * Use the `channel` and `type` fields for discriminated type narrowing.
 *
 * @example
 * ```typescript
 * function handleTunnelMessage(msg: TunnelMessage) {
 *   switch (msg.channel) {
 *     case 'shell':
 *       if (msg.type === 'data') {
 *         handleShellData(msg.data);
 *       }
 *       break;
 *     case 'logs':
 *       if (msg.type === 'entry') {
 *         displayLogEntry(msg);
 *       }
 *       break;
 *   }
 * }
 * ```
 */
export type TunnelMessage =
  | ShellMessage
  | LogsMessage
  | DiagMessage
  | ControlMessage
  | FilesMessage
  | UpdateMessage;

/**
 * Tunnel protocol message including session management.
 * This is the top-level message type for the tunnel WebSocket.
 */
export type TunnelProtocolMessage = TunnelMessage | SessionMessage;

// =============================================================================
// Session Info Types
// =============================================================================

/**
 * Information about an active tunnel session.
 */
export interface TunnelSessionInfo {
  /** Unique session identifier */
  sessionId: string;
  /** Channel type for this session */
  channel: TunnelChannel;
  /** Sensor ID this session is connected to */
  sensorId: string;
  /** Tenant ID owning the session */
  tenantId: string;
  /** Current session state */
  state: TunnelSessionState;
  /** Session creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Messages sent in this session */
  messagesSent: number;
  /** Messages received in this session */
  messagesReceived: number;
  /** Bytes transferred (approximate) */
  bytesTransferred: number;
}

/**
 * Rate limit configuration per channel type.
 */
export interface ChannelRateLimits {
  /** Messages per second limit */
  messagesPerSecond: number;
  /** Bytes per second limit */
  bytesPerSecond: number;
  /** Max concurrent sessions per sensor */
  maxSessionsPerSensor: number;
}

/**
 * Default rate limits per channel type.
 */
export const DEFAULT_CHANNEL_RATE_LIMITS: Record<TunnelChannel, ChannelRateLimits> = {
  shell: {
    messagesPerSecond: 100,
    bytesPerSecond: 65536 * 10, // 10 chunks/sec
    maxSessionsPerSensor: 3,
  },
  logs: {
    messagesPerSecond: 500,
    bytesPerSecond: 1024 * 1024, // 1MB/sec
    maxSessionsPerSensor: 5,
  },
  diag: {
    messagesPerSecond: 10,
    bytesPerSecond: 512 * 1024,
    maxSessionsPerSensor: 2,
  },
  control: {
    messagesPerSecond: 5,
    bytesPerSecond: 64 * 1024,
    maxSessionsPerSensor: 1,
  },
  files: {
    messagesPerSecond: 50,
    bytesPerSecond: 1024 * 1024 * 5, // 5MB/sec
    maxSessionsPerSensor: 2,
  },
  update: {
    messagesPerSecond: 10,
    bytesPerSecond: 1024 * 1024 * 10, // 10MB/sec
    maxSessionsPerSensor: 1,
  },
};

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a message is a shell channel message.
 */
export function isShellMessage(msg: TunnelMessage): msg is ShellMessage {
  return msg.channel === 'shell';
}

/**
 * Type guard to check if a message is a logs channel message.
 */
export function isLogsMessage(msg: TunnelMessage): msg is LogsMessage {
  return msg.channel === 'logs';
}

/**
 * Type guard to check if a message is a diagnostics channel message.
 */
export function isDiagMessage(msg: TunnelMessage): msg is DiagMessage {
  return msg.channel === 'diag';
}

/**
 * Type guard to check if a message is a control channel message.
 */
export function isControlMessage(msg: TunnelMessage): msg is ControlMessage {
  return msg.channel === 'control';
}

/**
 * Type guard to check if a message is a files channel message.
 */
export function isFilesMessage(msg: TunnelMessage): msg is FilesMessage {
  return msg.channel === 'files';
}

/**
 * Type guard to check if a message is a session management message.
 */
export function isSessionMessage(msg: TunnelProtocolMessage): msg is SessionMessage {
  return 'type' in msg && (
    msg.type === 'session-open' ||
    msg.type === 'session-opened' ||
    msg.type === 'session-close' ||
    msg.type === 'session-closed' ||
    msg.type === 'session-error'
  );
}
