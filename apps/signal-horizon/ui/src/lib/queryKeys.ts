/**
 * Query Key Factory for React Query
 *
 * Provides consistent query key patterns for cache management.
 * Using a factory pattern ensures type-safe, predictable keys across the app.
 *
 * @example
 * // In hooks/components:
 * import { fleetKeys, socKeys } from '@/lib/queryKeys';
 *
 * // Fetching sensors
 * useQuery({ queryKey: fleetKeys.sensors(mode) })
 *
 * // Invalidating all sensor data
 * queryClient.invalidateQueries({ queryKey: fleetKeys.all })
 *
 * // Invalidating specific sensor
 * queryClient.invalidateQueries({ queryKey: fleetKeys.sensor(id) })
 */

// =============================================================================
// Mode Helper Type
// =============================================================================

/** Query mode for demo vs live data */
export type QueryMode = string; // 'live' | scenario name

// =============================================================================
// Fleet Query Keys
// =============================================================================

export const fleetKeys = {
  /** Root key for all fleet queries */
  all: ['fleet'] as const,

  /** Fleet overview data */
  overview: (mode: QueryMode) => ['fleet', 'overview', mode] as const,

  /** Fleet-wide metrics */
  metrics: (mode: QueryMode) => ['fleet', 'metrics', mode] as const,

  /** Fleet health status */
  health: () => ['fleet', 'health'] as const,

  // ---------------------------------------------------------------------------
  // Sensors
  // ---------------------------------------------------------------------------

  /** All sensors list */
  sensors: (mode: QueryMode) => ['fleet', 'sensors', mode] as const,

  /** Single sensor base key */
  sensor: (id: string) => ['fleet', 'sensor', id] as const,

  /** Sensor detail data */
  sensorDetail: (id: string) => ['fleet', 'sensor', id, 'detail'] as const,

  /** Sensor system info */
  sensorSystem: (id: string) => ['fleet', 'sensor', id, 'system'] as const,

  /** Sensor performance metrics */
  sensorPerformance: (id: string) => ['fleet', 'sensor', id, 'performance'] as const,

  /** Sensor network stats */
  sensorNetwork: (id: string) => ['fleet', 'sensor', id, 'network'] as const,

  /** Sensor processes */
  sensorProcesses: (id: string) => ['fleet', 'sensor', id, 'processes'] as const,

  /** Sensor logs */
  sensorLogs: (id: string, logType: string) => ['fleet', 'sensor', id, 'logs', logType] as const,

  // ---------------------------------------------------------------------------
  // Sensor Configuration
  // ---------------------------------------------------------------------------

  /** Base config key for a sensor */
  sensorConfig: (id: string) => ['fleet', 'sensor', id, 'config'] as const,

  /** Full sensor configuration */
  sensorConfigFull: (id: string) => ['fleet', 'sensor', id, 'config', 'full'] as const,

  /** Pingora-specific configuration */
  sensorConfigPingora: (id: string) => ['fleet', 'sensor', id, 'config', 'pingora'] as const,

  // ---------------------------------------------------------------------------
  // Config Management
  // ---------------------------------------------------------------------------

  /** Base config key */
  config: () => ['fleet', 'config'] as const,

  /** Config templates */
  configTemplates: (mode: QueryMode) => ['fleet', 'config', 'templates', mode] as const,

  /** Config sync status */
  configSyncStatus: (mode: QueryMode) => ['fleet', 'config', 'sync-status', mode] as const,

  // ---------------------------------------------------------------------------
  // DLP
  // ---------------------------------------------------------------------------

  /** DLP base key */
  dlp: () => ['fleet', 'dlp'] as const,

  /** DLP statistics */
  dlpStats: (mode: QueryMode) => ['fleet', 'dlp', 'stats', mode] as const,

  /** DLP violations */
  dlpViolations: (mode: QueryMode) => ['fleet', 'dlp', 'violations', mode] as const,

  // ---------------------------------------------------------------------------
  // Rules
  // ---------------------------------------------------------------------------

  /** Rules base key */
  rules: () => ['fleet', 'rules'] as const,

  /** Rules list */
  rulesList: () => ['fleet', 'rules'] as const,

  /** Rules sync status */
  rulesSyncStatus: () => ['fleet', 'rules', 'sync-status'] as const,

  // ---------------------------------------------------------------------------
  // Releases & Rollouts
  // ---------------------------------------------------------------------------

  /** Releases base key */
  releases: (mode: QueryMode) => ['fleet', 'releases', mode] as const,

  /** Rollouts with dependency on releases count */
  rollouts: (mode: QueryMode, releasesCount?: number) =>
    ['fleet', 'rollouts', mode, releasesCount] as const,

  // ---------------------------------------------------------------------------
  // Updates
  // ---------------------------------------------------------------------------

  /** Updates base key */
  updates: () => ['fleet', 'updates'] as const,

  /** Available versions */
  updatesVersions: () => ['fleet', 'updates', 'versions'] as const,

  /** Available updates */
  updatesAvailable: () => ['fleet', 'updates', 'available'] as const,

  // ---------------------------------------------------------------------------
  // Bandwidth
  // ---------------------------------------------------------------------------

  /** Bandwidth base key */
  bandwidth: (mode: QueryMode) => ['fleet', 'bandwidth', mode] as const,

  /** Bandwidth timeline */
  bandwidthTimeline: (granularity: string, duration: number, mode: QueryMode) =>
    ['fleet', 'bandwidth', 'timeline', granularity, duration, mode] as const,

  /** Bandwidth by endpoint */
  bandwidthEndpoints: (mode: QueryMode) => ['fleet', 'bandwidth', 'endpoints', mode] as const,

  /** Bandwidth billing */
  bandwidthBilling: (start: string, end: string, costPerGb: number, mode: QueryMode) =>
    ['fleet', 'bandwidth', 'billing', start, end, costPerGb, mode] as const,

  /** Bandwidth by sensor */
  bandwidthSensor: (sensorId: string, mode: QueryMode) =>
    ['fleet', 'bandwidth', 'sensor', sensorId, mode] as const,

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  /** Sessions base key */
  sessions: () => ['fleet', 'sessions'] as const,

  /** Sessions stats */
  sessionsStats: (mode: QueryMode) => ['fleet', 'sessions', 'stats', mode] as const,
} as const;

// =============================================================================
// Diagnostics Query Keys
// =============================================================================

export const diagnosticsKeys = {
  /** Root key for all diagnostics queries */
  all: ['diagnostics'] as const,

  /** Diagnostics for a specific sensor */
  sensor: (sensorId: string) => ['diagnostics', sensorId] as const,

  /** Diagnostics with specific sections */
  sensorSections: (sensorId: string, sections: string | undefined, mode: QueryMode) =>
    ['diagnostics', sensorId, sections, mode] as const,
} as const;

// =============================================================================
// SOC (Security Operations Center) Query Keys
// =============================================================================

export const socKeys = {
  /** Root key for all SOC queries */
  all: ['soc'] as const,

  // ---------------------------------------------------------------------------
  // Campaigns
  // ---------------------------------------------------------------------------

  /** Campaigns base key */
  campaigns: (sensorId: string | undefined, status: string | undefined, isDemoMode: boolean, scenario: string) =>
    ['soc', 'campaigns', sensorId, status, isDemoMode, scenario] as const,

  /** Single campaign */
  campaign: (sensorId: string | undefined, id: string, isDemoMode: boolean) =>
    ['soc', 'campaign', sensorId, id, isDemoMode] as const,

  /** Campaign actors */
  campaignActors: (sensorId: string | undefined, id: string, isDemoMode: boolean) =>
    ['soc', 'campaign-actors', sensorId, id, isDemoMode] as const,

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  /** Sessions list */
  sessions: (sensorId: string | undefined, params: unknown, isDemoMode: boolean, scenario: string) =>
    ['soc', 'sessions', sensorId, params, isDemoMode, scenario] as const,

  /** Single session */
  session: (sensorId: string | undefined, id: string, isDemoMode: boolean) =>
    ['soc', 'session', sensorId, id, isDemoMode] as const,

  // ---------------------------------------------------------------------------
  // Actors
  // ---------------------------------------------------------------------------

  /** Actors list */
  actors: (sensorId: string | undefined, params: unknown, isDemoMode: boolean, scenario: string) =>
    ['soc', 'actors', sensorId, params, isDemoMode, scenario] as const,

  /** Single actor */
  actor: (sensorId: string | undefined, id: string, isDemoMode: boolean) =>
    ['soc', 'actor', sensorId, id, isDemoMode] as const,

  /** Actor timeline */
  actorTimeline: (sensorId: string | undefined, id: string, isDemoMode: boolean) =>
    ['soc', 'actor-timeline', sensorId, id, isDemoMode] as const,

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /** Search results */
  search: (sensorId: string | undefined, term: string | undefined, type: string | undefined, isDemoMode: boolean) =>
    ['soc', 'search', sensorId, term, type, isDemoMode] as const,
} as const;

// =============================================================================
// Onboarding Query Keys
// =============================================================================

export const onboardingKeys = {
  /** Root key for all onboarding queries */
  all: ['onboarding'] as const,

  /** Onboarding stats */
  stats: () => ['onboarding-stats'] as const,

  /** Registration tokens */
  tokens: () => ['registration-tokens'] as const,

  /** Pending sensors */
  pending: () => ['pending-sensors'] as const,
} as const;

// =============================================================================
// Connectivity Query Keys
// =============================================================================

export const connectivityKeys = {
  /** Root key */
  all: ['connectivity'] as const,

  /** Connectivity stats */
  stats: () => ['connectivity-stats'] as const,

  /** Sensor connectivity */
  sensors: () => ['sensor-connectivity'] as const,
} as const;

// =============================================================================
// Sensor Keys Management
// =============================================================================

export const sensorManagementKeys = {
  /** Root key */
  all: ['sensor-management'] as const,

  /** Sensor API keys */
  keys: () => ['sensor-keys'] as const,

  /** Sensors list (for key management) */
  list: () => ['sensors-list'] as const,
} as const;

// =============================================================================
// Docs Query Keys
// =============================================================================

export const docsKeys = {
  /** Root key */
  all: ['docs'] as const,

  /** Docs index */
  index: () => ['docs', 'index'] as const,

  /** Doc content by ID */
  content: (docId: string) => ['docs', 'content', docId] as const,
} as const;

// =============================================================================
// Utility: Get Mode String
// =============================================================================

/**
 * Helper to get the mode string for query keys.
 * Use in hooks that support demo mode.
 */
export function getQueryMode(isDemoMode: boolean, scenario: string): QueryMode {
  return isDemoMode ? scenario : 'live';
}
