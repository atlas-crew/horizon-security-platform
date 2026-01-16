/**
 * Fleet Session Query Types
 * Types for global session search across all connected sensors in a fleet
 */

import { z } from 'zod';

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

/**
 * Time range filter for session queries
 */
export const TimeRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date().optional(),
});

/**
 * Session search query parameters
 */
export const SessionSearchQuerySchema = z.object({
  /** Optional specific session ID to find */
  sessionId: z.string().optional(),
  /** Search by actor identifier */
  actorId: z.string().optional(),
  /** Search by client IP address */
  clientIp: z.string().optional(),
  /** Search by JA4 TLS fingerprint */
  ja4Fingerprint: z.string().optional(),
  /** Search by User-Agent substring */
  userAgent: z.string().optional(),
  /** Time range filter */
  timeRange: TimeRangeSchema.optional(),
  /** Minimum risk score threshold (0-100) */
  riskScoreMin: z.number().min(0).max(100).optional(),
  /** Include only blocked sessions */
  blockedOnly: z.boolean().optional(),
  /** Maximum results per sensor (default: 50) */
  limitPerSensor: z.number().min(1).max(500).default(50),
});

/**
 * Session revoke request
 */
export const SessionRevokeRequestSchema = z.object({
  /** Reason for revoking the session */
  reason: z.string().min(1).max(500).optional(),
});

/**
 * Global session revoke request
 */
export const GlobalSessionRevokeRequestSchema = z.object({
  /** Reason for revoking the session */
  reason: z.string().min(1).max(500).optional(),
  /** Specific sensor IDs to target (optional, defaults to all) */
  sensorIds: z.array(z.string()).optional(),
});

/**
 * Actor ban request
 */
export const ActorBanRequestSchema = z.object({
  /** Reason for banning the actor */
  reason: z.string().min(1).max(500),
  /** Ban duration in seconds (optional, permanent if not specified) */
  durationSeconds: z.number().min(60).max(31536000).optional(), // 1 min to 1 year
  /** Specific sensor IDs to target (optional, defaults to all) */
  sensorIds: z.array(z.string()).optional(),
});

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Time range for session queries
 */
export interface TimeRange {
  start: Date;
  end?: Date;
}

/**
 * Session search query parameters
 */
export interface SessionSearchQuery {
  /** Optional specific session ID to find */
  sessionId?: string;
  /** Search by actor identifier */
  actorId?: string;
  /** Search by client IP address */
  clientIp?: string;
  /** Search by JA4 TLS fingerprint */
  ja4Fingerprint?: string;
  /** Search by User-Agent substring */
  userAgent?: string;
  /** Time range filter */
  timeRange?: TimeRange;
  /** Minimum risk score threshold (0-100) */
  riskScoreMin?: number;
  /** Include only blocked sessions */
  blockedOnly?: boolean;
  /** Maximum results per sensor (default: 50) */
  limitPerSensor?: number;
}

/**
 * Session data from a sensor
 */
export interface SensorSession {
  /** Unique session identifier */
  id: string;
  /** Actor identifier associated with this session */
  actorId: string;
  /** Client IP address */
  clientIp: string;
  /** Current risk score (0-100) */
  riskScore: number;
  /** Total requests made in this session */
  requestCount: number;
  /** Timestamp of last activity */
  lastSeen: Date;
  /** Whether this session is currently blocked */
  isBlocked: boolean;
  /** JA4 TLS fingerprint (if available) */
  ja4Fingerprint?: string;
  /** User-Agent string (if available) */
  userAgent?: string;
  /** Session creation time */
  createdAt: Date;
  /** Reason for block (if blocked) */
  blockReason?: string;
  /** Associated threat categories */
  threatCategories?: string[];
  /** Country code from GeoIP */
  countryCode?: string;
  /** ASN from IP lookup */
  asn?: string;
}

/**
 * Result from searching a single sensor
 */
export interface SessionSearchResult {
  /** Sensor identifier */
  sensorId: string;
  /** Sensor display name */
  sensorName: string;
  /** Sessions matching the query */
  sessions: SensorSession[];
  /** How long the search took on this sensor (ms) */
  searchDurationMs: number;
  /** Error message if search failed */
  error?: string;
  /** Whether this sensor was online during search */
  online: boolean;
  /** Total sessions on this sensor (may exceed returned results) */
  totalMatches?: number;
}

/**
 * Aggregated search results across all sensors
 */
export interface GlobalSessionSearchResult {
  /** Results per sensor */
  results: SessionSearchResult[];
  /** Total sessions found across all sensors */
  totalSessions: number;
  /** Total sensors queried */
  totalSensors: number;
  /** Sensors that responded successfully */
  successfulSensors: number;
  /** Sensors that failed or timed out */
  failedSensors: number;
  /** Total search duration (ms) */
  searchDurationMs: number;
  /** Query that was executed */
  query: SessionSearchQuery;
}

/**
 * Result from revoking a session on a single sensor
 */
export interface SensorRevokeResult {
  /** Sensor identifier */
  sensorId: string;
  /** Whether the revocation was successful */
  success: boolean;
  /** Session ID that was revoked */
  sessionId: string;
  /** Error message if revocation failed */
  error?: string;
}

/**
 * Result from revoking a session globally
 */
export interface GlobalRevokeResult {
  /** Session ID that was revoked */
  sessionId: string;
  /** Results per sensor */
  results: SensorRevokeResult[];
  /** Total sensors targeted */
  totalSensors: number;
  /** Successful revocations */
  successCount: number;
  /** Failed revocations */
  failureCount: number;
}

/**
 * Result from banning an actor on a single sensor
 */
export interface SensorBanResult {
  /** Sensor identifier */
  sensorId: string;
  /** Whether the ban was successful */
  success: boolean;
  /** Actor ID that was banned */
  actorId: string;
  /** Number of active sessions terminated */
  sessionsTerminated?: number;
  /** Error message if ban failed */
  error?: string;
}

/**
 * Result from banning an actor globally
 */
export interface GlobalBanResult {
  /** Actor ID that was banned */
  actorId: string;
  /** Reason for the ban */
  reason: string;
  /** Duration in seconds (undefined = permanent) */
  durationSeconds?: number;
  /** Results per sensor */
  results: SensorBanResult[];
  /** Total sensors targeted */
  totalSensors: number;
  /** Successful bans */
  successCount: number;
  /** Failed bans */
  failureCount: number;
  /** Total sessions terminated across all sensors */
  totalSessionsTerminated: number;
}

/**
 * Fleet-wide session statistics
 */
export interface FleetSessionStats {
  /** Total active sessions across fleet */
  totalActiveSessions: number;
  /** Total blocked sessions across fleet */
  totalBlockedSessions: number;
  /** Total unique actors across fleet */
  uniqueActors: number;
  /** Average risk score across active sessions */
  averageRiskScore: number;
  /** Sessions by risk tier */
  sessionsByRiskTier: {
    low: number;    // 0-25
    medium: number; // 26-50
    high: number;   // 51-75
    critical: number; // 76-100
  };
  /** Top threat categories */
  topThreatCategories: Array<{
    category: string;
    count: number;
  }>;
  /** Stats per sensor */
  sensorStats: Array<{
    sensorId: string;
    sensorName: string;
    activeSessions: number;
    blockedSessions: number;
    online: boolean;
  }>;
  /** Timestamp of stats collection */
  timestamp: Date;
}

// =============================================================================
// Type Inference from Schemas
// =============================================================================

export type SessionSearchQueryInput = z.infer<typeof SessionSearchQuerySchema>;
export type SessionRevokeRequest = z.infer<typeof SessionRevokeRequestSchema>;
export type GlobalSessionRevokeRequest = z.infer<typeof GlobalSessionRevokeRequestSchema>;
export type ActorBanRequest = z.infer<typeof ActorBanRequestSchema>;
