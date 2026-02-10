/**
 * TunnelBroker Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import type { Logger } from 'pino';
import { TunnelBroker } from '../tunnel-broker.js';
import type { TunnelMessage } from '../../types/tunnel.js';

class MockWebSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  sentMessages: string[] = [];

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }
}

const createLogger = (): Logger => ({
  child: vi.fn().mockReturnThis(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger);

const createShellStartMessage = (sessionId: string, sequenceId: number): TunnelMessage => ({
  channel: 'shell',
  sessionId,
  sequenceId,
  timestamp: Date.now(),
  type: 'start',
  cols: 80,
  rows: 24,
});

describe('TunnelBroker', () => {
  let broker: TunnelBroker;

  beforeEach(() => {
    vi.useFakeTimers();
    broker = new TunnelBroker(createLogger(), {
      sessionTimeoutMs: 60_000,
      maxSessionsPerSensor: 2,
    });
  });

  afterEach(async () => {
    await broker.shutdown();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('routes channel messages to registered handlers', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    broker.onChannelMessage('shell', handler);

    const clientWs = new MockWebSocket();
    const sessionId = broker.createSession('sensor-1', 'shell', clientWs as unknown as WebSocket, {
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(sessionId).toBeTruthy();

    const message = createShellStartMessage(sessionId!, 1);
    const routed = vi.fn();
    broker.on('message-routed', routed);

    clientWs.emit('message', Buffer.from(JSON.stringify(message)));
    
    // Process promises and timers
    await vi.runOnlyPendingTimersAsync();

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sessionId }), message);
    expect(routed).toHaveBeenCalledWith(sessionId, 'shell', 'client-to-sensor');
  });

  it('enforces per-channel rate limits', async () => {
    broker = new TunnelBroker(createLogger(), {
      rateLimits: {
        shell: { messagesPerSecond: 1, bytesPerSecond: 1024, maxSessionsPerSensor: 1 },
      },
    });

    const handler = vi.fn().mockResolvedValue(undefined);
    broker.onChannelMessage('shell', handler);

    const clientWs = new MockWebSocket();
    const sessionId = broker.createSession('sensor-1', 'shell', clientWs as unknown as WebSocket, {
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    const rateLimited = vi.fn();
    broker.on('rate-limited', rateLimited);

    const message = createShellStartMessage(sessionId!, 1);
    clientWs.emit('message', Buffer.from(JSON.stringify(message)));
    clientWs.emit('message', Buffer.from(JSON.stringify({ ...message, sequenceId: 2 })));

    await vi.runOnlyPendingTimersAsync();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(rateLimited).toHaveBeenCalledWith(sessionId, 'shell', expect.stringContaining('Rate limit exceeded'));

    const lastSent = clientWs.sentMessages[clientWs.sentMessages.length - 1];
    expect(JSON.parse(lastSent)).toMatchObject({
      type: 'session-error',
      code: 'RATE_LIMITED',
      sessionId,
      channel: 'shell',
    });
  });

  it('closes sessions and cleans up tracking', () => {
    const clientWs = new MockWebSocket();
    const sessionId = broker.createSession('sensor-1', 'shell', clientWs as unknown as WebSocket, {
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    const closed = vi.fn();
    broker.on('session-closed', closed);

    broker.closeSession(sessionId!, 'Test close');

    expect(broker.getSession(sessionId!)).toBeUndefined();
    expect(broker.getSensorSessions('sensor-1')).toHaveLength(0);
    expect(closed).toHaveBeenCalledWith(sessionId, 'Test close', expect.any(Object));
  });

  it('enforces max sessions per sensor', () => {
    broker = new TunnelBroker(createLogger(), { maxSessionsPerSensor: 1 });

    const first = broker.createSession('sensor-1', 'shell', new MockWebSocket() as unknown as WebSocket, {
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    const second = broker.createSession('sensor-1', 'shell', new MockWebSocket() as unknown as WebSocket, {
      tenantId: 'tenant-1',
      userId: 'user-2',
    });

    expect(first).toBeTruthy();
    expect(second).toBeNull();
  });

  describe('Sensor Integration', () => {
    it('registers sensor connection and routes sensor messages', async () => {
      const clientWs = new MockWebSocket();
      const sessionId = broker.createSession('sensor-1', 'shell', clientWs as unknown as WebSocket, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      const sensorWs = new MockWebSocket();
      broker.registerSensorConnection(sessionId!, sensorWs as unknown as WebSocket);

      const session = broker.getSession(sessionId!);
      expect(session?.state).toBe('active');

      const sensorMessage: TunnelMessage = {
        channel: 'shell',
        sessionId: sessionId!,
        sequenceId: 100,
        timestamp: Date.now(),
        type: 'data',
        data: 'terminal output',
      };

      const routed = vi.fn();
      broker.on('message-routed', routed);

      sensorWs.emit('message', Buffer.from(JSON.stringify(sensorMessage)));
      
      const lastClientSent = clientWs.sentMessages[clientWs.sentMessages.length - 1];
      expect(JSON.parse(lastClientSent)).toMatchObject(sensorMessage);
      expect(routed).toHaveBeenCalledWith(sessionId, 'shell', 'sensor-to-client');
    });

    it('cleans up all sessions for a sensor on cleanupSensor', () => {
      broker.createSession('sensor-1', 'shell', new MockWebSocket() as unknown as WebSocket, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      });
      broker.createSession('sensor-1', 'logs', new MockWebSocket() as unknown as WebSocket, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      expect(broker.getSensorSessions('sensor-1')).toHaveLength(2);

      broker.cleanupSensor('sensor-1');

      expect(broker.getSensorSessions('sensor-1')).toHaveLength(0);
    });
  });

  describe('Legacy Protocol', () => {
    it('supports legacy sensor connection', () => {
      const sensorWs = new MockWebSocket();
      const connected = vi.fn();
      broker.on('tunnel:connected', connected);

      broker.handleSensorConnect(sensorWs as unknown as WebSocket, 'sensor-1', 'tenant-1', ['shell']);

      expect(broker.getTunnelStatus('sensor-1')).toBeTruthy();
      expect(connected).toHaveBeenCalled();
    });

    it('rejects new legacy tunnel when sensor is already connected', () => {
      const primaryWs = new MockWebSocket();
      const secondaryWs = new MockWebSocket();

      broker.handleSensorConnect(primaryWs as unknown as WebSocket, 'sensor-1', 'tenant-1', ['shell']);
      broker.handleSensorConnect(secondaryWs as unknown as WebSocket, 'sensor-1', 'tenant-1', ['shell']);

      expect(secondaryWs.readyState).toBe(WebSocket.CLOSED);
      expect(broker.getTunnelStatus('sensor-1')?.socket).toBe(primaryWs);
    });

    it('starts legacy shell session', () => {
      const sensorWs = new MockWebSocket();
      broker.handleSensorConnect(sensorWs as unknown as WebSocket, 'sensor-1', 'tenant-1', ['shell']);

      const clientWs = new MockWebSocket();
      const started = vi.fn();
      broker.on('session:started', started);

      const sessionId = broker.startShellSession(clientWs as unknown as WebSocket, 'user-1', 'tenant-1', 'sensor-1');

      expect(sessionId).toBeTruthy();
      expect(started).toHaveBeenCalled();
      
      // Verify sensor was notified to start shell
      const lastSensorSent = sensorWs.sentMessages[sensorWs.sentMessages.length - 1];
      expect(JSON.parse(lastSensorSent)).toMatchObject({
        type: 'shell-data',
        payload: { action: 'start' },
      });
    });

    it('enforces heartbeat timeouts', () => {
      const sensorWs = new MockWebSocket();
      broker.handleSensorConnect(sensorWs as unknown as WebSocket, 'sensor-1', 'tenant-1', ['shell']);

      const disconnected = vi.fn();
      broker.on('tunnel:disconnected', disconnected);

      // Advance past 90s (INTERVAL=30s, TIMEOUT=60s)
      // At 30s: check (30 < 60) -> ok
      // At 60s: check (60 <= 60) -> ok
      // At 90s: check (90 > 60) -> timeout
      vi.advanceTimersByTime(90001);

      expect(disconnected).toHaveBeenCalledWith('sensor-1', 'tenant-1');
      expect(broker.getTunnelStatus('sensor-1')).toBeNull();
    });
  });

  describe('Monitoring and Direct Communication', () => {
    it('provides combined statistics', () => {
      // New protocol session
      broker.createSession('sensor-1', 'shell', new MockWebSocket() as unknown as WebSocket, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      // Legacy protocol tunnel and session
      const sensorWs = new MockWebSocket();
      broker.handleSensorConnect(sensorWs as unknown as WebSocket, 'sensor-2', 'tenant-1', ['shell']);
      broker.startShellSession(new MockWebSocket() as unknown as WebSocket, 'user-2', 'tenant-1', 'sensor-2');

      const stats = broker.getStats();
      expect(stats.totalTunnels).toBe(1); // Legacy tunnels
      expect(stats.activeSessions).toBe(2); // One new, one legacy
      expect(stats.byChannel.shell).toBe(1); // New protocol
      expect(stats.byType.shell).toBe(1); // Legacy protocol
    });

    it('handles direct sensor requests (sendRequest)', async () => {
      const sensorWs = new MockWebSocket();
      broker.handleSensorConnect(sensorWs as unknown as WebSocket, 'sensor-1', 'tenant-1', ['shell']);

      const requestPromise = broker.sendRequest('sensor-1', { type: 'bandwidth-stats', payload: {} });

      // Verify request sent to sensor
      const lastSent = JSON.parse(sensorWs.sentMessages[0]);
      expect(lastSent.type).toBe('bandwidth-stats');
      expect(lastSent.requestId).toBeTruthy();

      // Mock response from sensor
      const response = {
        type: 'bandwidth-stats',
        requestId: lastSent.requestId,
        payload: { rx: 100, tx: 200 },
        timestamp: new Date().toISOString(),
      };
      sensorWs.emit('message', Buffer.from(JSON.stringify(response)));

      const result = await requestPromise;
      expect(result.payload).toEqual({ rx: 100, tx: 200 });
    });
  });
});
