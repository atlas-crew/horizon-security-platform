/**
 * Fleet Management Types
 * Shared types for fleet services
 */

export interface SensorMetricsSnapshot {
  sensorId: string;
  tenantId: string;
  rps: number;
  latency: number; // milliseconds
  cpu: number; // percentage 0-100
  memory: number; // percentage 0-100
  disk: number; // percentage 0-100
  health: 'healthy' | 'degraded' | 'critical';
  lastHeartbeat: Date;
  requestsTotal: number;
}

export interface FleetMetrics {
  totalSensors: number;
  onlineSensors: number;
  offlineSensors: number;
  totalRps: number;
  avgLatency: number;
  healthScore: number; // 0-100
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
  timestamp: Date;
}

export interface RegionMetrics {
  region: string;
  sensors: number;
  onlineSensors: number;
  totalRps: number;
  avgLatency: number;
  healthScore: number;
}

export interface SensorAlert {
  sensorId: string;
  tenantId: string;
  alertType: 'degraded' | 'high_cpu' | 'high_memory' | 'high_disk' | 'offline';
  severity: 'warning' | 'critical';
  message: string;
  value?: number;
  threshold?: number;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description?: string;
  environment: 'production' | 'staging' | 'dev';
  config: Record<string, unknown>;
  hash: string;
  version: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigSyncState {
  sensorId: string;
  configInSync: boolean;
  rulesInSync: boolean;
  blocklistInSync: boolean;
  lastSyncAttempt?: Date;
  lastSyncSuccess?: Date;
  syncErrors: string[];
}

export interface FleetSyncStatus {
  totalSensors: number;
  syncedSensors: number;
  outOfSyncSensors: number;
  errorSensors: number;
  syncPercentage: number;
}

export interface ConfigDiff {
  sensorId: string;
  currentConfig: Record<string, unknown> | null;
  targetConfig: Record<string, unknown>;
  differences: Array<{
    path: string;
    current: unknown;
    target: unknown;
    action: 'add' | 'modify' | 'remove';
  }>;
}

export interface DeploymentResult {
  success: boolean;
  totalTargets: number;
  successCount: number;
  failureCount: number;
  pendingCount: number;
  results: Array<{
    sensorId: string;
    success: boolean;
    error?: string;
    commandId?: string;
  }>;
}

export interface SensorCommand {
  type: 'push_config' | 'push_rules' | 'update' | 'restart' | 'sync_blocklist';
  payload: Record<string, unknown>;
  timeout?: number; // milliseconds, default 30000
}

export interface CommandStatus {
  commandId: string;
  sensorId: string;
  status: 'pending' | 'sent' | 'success' | 'failed' | 'timeout';
  result?: Record<string, unknown>;
  error?: string;
  queuedAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  attempts: number;
}

export interface Command {
  id: string;
  sensorId: string;
  commandType: string;
  payload: Record<string, unknown>;
  status: string;
  result?: Record<string, unknown>;
  error?: string;
  queuedAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  attempts: number;
  timeoutAt: Date;
}

export interface RuleSyncStatus {
  sensorId: string;
  totalRules: number;
  syncedRules: number;
  pendingRules: number;
  failedRules: number;
  lastSync?: Date;
  errors: string[];
}

export interface SensorRuleStatus {
  sensorId: string;
  rules: Array<{
    ruleId: string;
    status: 'pending' | 'synced' | 'failed';
    syncedAt?: Date;
    error?: string;
  }>;
}

export interface Rule {
  id: string;
  name: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  enabled: boolean;
  priority: number;
}

export type RolloutStrategy = 'immediate' | 'canary' | 'scheduled';

export interface RolloutConfig {
  strategy: RolloutStrategy;
  canaryPercentages?: number[]; // e.g., [10, 50, 100]
  delayBetweenStages?: number; // milliseconds
  scheduledTime?: Date;
}

/**
 * Sensor Heartbeat (from protocol types, extended for fleet management)
 */
export interface SensorHeartbeat {
  sensorId: string;
  tenantId: string;
  timestamp: Date;
  metrics: {
    rps: number;
    latency: number;
    cpu: number;
    memory: number;
    disk: number;
  };
  health: 'healthy' | 'degraded' | 'critical';
  requestsTotal: number;
  region?: string;
  metadata?: Record<string, unknown>;
}
