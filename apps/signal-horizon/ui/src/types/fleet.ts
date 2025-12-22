export type SensorStatus = 'online' | 'warning' | 'offline';
export type RolloutStrategy = 'immediate' | 'canary' | 'scheduled';

export interface SensorSummary {
  id: string;
  name: string;
  status: SensorStatus;
  cpu: number;
  memory: number;
  rps: number;
  latencyMs: number;
  version: string;
  region: string;
}

export interface FleetMetrics {
  totalSensors: number;
  onlineCount: number;
  warningCount: number;
  offlineCount: number;
  totalRps: number;
  avgLatencyMs: number;
}

export interface SensorDetail extends SensorSummary {
  uptime: number;
  lastSeen: string;
  configVersion: string;
  errors: number;
}

export interface PerformanceMetric {
  timestamp: string;
  cpu: number;
  memory: number;
  rps: number;
  latencyMs: number;
}
