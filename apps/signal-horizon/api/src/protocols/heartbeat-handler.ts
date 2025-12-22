/**
 * HeartbeatHandler manages sensor health monitoring and state tracking.
 * Processes heartbeats every 60 seconds, detects timeouts after 90s.
 */

import { EventEmitter } from 'events';
import type { SensorHeartbeat } from '../types/protocol.js';

interface SensorState {
  sensorId: string;
  tenantId: string;
  lastHeartbeat: number;
  status: 'online' | 'warning' | 'offline';
  metrics: {
    cpu: number;
    memory: number;
    rps: number;
    latencyMs: number;
  };
  configHash: string;
  rulesHash: string;
}

export class HeartbeatHandler extends EventEmitter {
  private sensors = new Map<string, SensorState>();
  private timeoutMs = 90000; // 90 seconds (sensors send every 60s)
  private checkInterval: NodeJS.Timeout | null = null;

  /** Start periodic timeout checking */
  start(): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => this.checkTimeouts(), 30000);
  }

  /** Stop the timeout checker */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /** Process incoming heartbeat from a sensor */
  handleHeartbeat(sensorId: string, tenantId: string, heartbeat: SensorHeartbeat): void {
    const isNew = !this.sensors.has(sensorId);
    const status = this.deriveStatus(heartbeat);
    const now = Date.now();

    const sensorState: SensorState = {
      sensorId,
      tenantId,
      lastHeartbeat: now,
      status,
      metrics: {
        cpu: heartbeat.cpu,
        memory: heartbeat.memory,
        rps: heartbeat.requestsLastMinute / 60,
        latencyMs: heartbeat.avgLatencyMs,
      },
      configHash: heartbeat.configHash,
      rulesHash: heartbeat.rulesHash,
    };

    this.sensors.set(sensorId, sensorState);

    if (isNew) {
      this.emit('sensor-online', sensorId, sensorState);
    }
    if (status === 'warning') {
      this.emit('sensor-attention', sensorId, sensorState);
    }
    this.emit('heartbeat', sensorId, sensorState);
  }

  /** Derive sensor status from metrics */
  private deriveStatus(hb: SensorHeartbeat): 'online' | 'warning' | 'offline' {
    if (hb.cpu > 80 || hb.memory > 90 || hb.avgLatencyMs > 200) {
      return 'warning';
    }
    return 'online';
  }

  /** Check for timed-out sensors */
  private checkTimeouts(): void {
    const now = Date.now();
    for (const [id, sensor] of this.sensors) {
      if (now - sensor.lastHeartbeat > this.timeoutMs && sensor.status !== 'offline') {
        sensor.status = 'offline';
        this.emit('sensor-offline', id, sensor);
      }
    }
  }

  getSensor(sensorId: string): SensorState | undefined {
    return this.sensors.get(sensorId);
  }

  getAllSensors(): SensorState[] {
    return Array.from(this.sensors.values());
  }

  getOnlineSensors(): SensorState[] {
    return this.getAllSensors().filter((s) => s.status !== 'offline');
  }

  getTenantSensors(tenantId: string): SensorState[] {
    return this.getAllSensors().filter((s) => s.tenantId === tenantId);
  }

  getFleetMetrics(): {
    total: number;
    online: number;
    warning: number;
    offline: number;
    avgCpu: number;
    avgMemory: number;
    totalRps: number;
    avgLatency: number;
  } {
    const sensors = this.getAllSensors();
    const online = sensors.filter((s) => s.status === 'online');
    const warning = sensors.filter((s) => s.status === 'warning');
    const offline = sensors.filter((s) => s.status === 'offline');
    const active = sensors.filter((s) => s.status !== 'offline');

    return {
      total: sensors.length,
      online: online.length,
      warning: warning.length,
      offline: offline.length,
      avgCpu: active.length > 0 ? active.reduce((sum, s) => sum + s.metrics.cpu, 0) / active.length : 0,
      avgMemory: active.length > 0 ? active.reduce((sum, s) => sum + s.metrics.memory, 0) / active.length : 0,
      totalRps: active.reduce((sum, s) => sum + s.metrics.rps, 0),
      avgLatency: active.length > 0 ? active.reduce((sum, s) => sum + s.metrics.latencyMs, 0) / active.length : 0,
    };
  }

  removeSensor(sensorId: string): boolean {
    return this.sensors.delete(sensorId);
  }

  setTimeoutMs(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;
  }

  clear(): void {
    this.sensors.clear();
  }
}
