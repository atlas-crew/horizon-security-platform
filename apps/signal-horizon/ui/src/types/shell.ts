/**
 * Shell-specific type definitions for Remote Shell functionality
 * Used for WebSocket-based terminal sessions to sensors
 */

/** Shell session status */
export type ShellSessionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Represents an active shell session to a sensor */
export interface ShellSession {
  /** Unique session identifier */
  id: string;
  /** Target sensor ID */
  sensorId: string;
  /** Current connection status */
  status: ShellSessionStatus;
  /** Session start timestamp */
  startedAt: Date;
  /** Error message if status is 'error' */
  error?: string;
}

/** Message types for shell WebSocket communication */
export type ShellMessageType = 'data' | 'resize' | 'exit' | 'error' | 'init' | 'ping' | 'pong';

/** WebSocket message structure for shell communication */
export interface ShellMessage {
  /** Message type */
  type: ShellMessageType;
  /** Session identifier */
  sessionId: string;
  /** Base64 encoded data (for 'data' type) */
  data?: string;
  /** Terminal columns (for 'resize' type) */
  cols?: number;
  /** Terminal rows (for 'resize' type) */
  rows?: number;
  /** Exit code (for 'exit' type) */
  code?: number;
  /** Error message (for 'error' type) */
  error?: string;
  /** Timestamp */
  timestamp?: number;
}

/** Incoming shell message from server */
export interface ShellServerMessage {
  type: 'shell-data' | 'shell-exit' | 'shell-error' | 'shell-ready' | 'pong';
  sessionId?: string;
  payload?: {
    data?: string;
    code?: number;
    error?: string;
  };
  timestamp?: number;
}

/** Shell initialization options */
export interface ShellInitOptions {
  /** Terminal columns */
  cols: number;
  /** Terminal rows */
  rows: number;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Shell command (default: /bin/bash) */
  shell?: string;
}

/** Shell session configuration */
export interface ShellSessionConfig {
  /** Maximum session duration in seconds (default: 1800 = 30 min) */
  maxDuration?: number;
  /** Idle timeout in seconds (default: 300 = 5 min) */
  idleTimeout?: number;
  /** Enable session recording */
  recordSession?: boolean;
  /** Session audit tags */
  auditTags?: string[];
}

/** Shell reconnection options */
export interface ShellReconnectOptions {
  /** Maximum reconnection attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
}
