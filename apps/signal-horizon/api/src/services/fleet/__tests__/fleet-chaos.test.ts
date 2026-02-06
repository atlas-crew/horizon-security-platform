/**
 * Fleet Management Chaos Tests (labs-2j5u.12, labs-2j5u.18)
 *
 * Tests system resilience under adverse conditions:
 * - Network partitions (WebSocket disconnects)
 * - Sensor crash/restarts
 * - Service crash recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { FleetCommander } from '../fleet-commander.js';
import { CommandSender } from '../../../protocols/command-sender.js';

// Test constants
const TEST_TENANT_ID = 'tenant-chaos-123';
const TEST_SENSOR_ID = 'sensor-chaos-456';

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  readyState = 1; // OPEN
  sentMessages: string[] = [];

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }
}

// Create mock Prisma client
function createMockPrisma() {
  const commands = new Map<string, any>();
  let commandIdCounter = 0;

  const mock = {
    sensor: {
      findUnique: vi.fn().mockResolvedValue({ id: TEST_SENSOR_ID, tenantId: TEST_TENANT_ID }),
      findMany: vi.fn().mockResolvedValue([{ id: TEST_SENSOR_ID }]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    fleetCommand: {
      create: vi.fn().mockImplementation(({ data }) => {
        const id = `cmd-${++commandIdCounter}`;
        const command = { id, ...data };
        commands.set(id, command);
        return Promise.resolve(command);
      }),
      findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
        const cmd = commands.get(id);
        if (cmd) {
          return Promise.resolve({ ...cmd, sensor: { id: cmd.sensorId, tenantId: TEST_TENANT_ID } });
        }
        return Promise.resolve(null);
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockImplementation(({ where }) => {
        const results = Array.from(commands.values()).filter(c => {
          if (where?.status?.in && !where.status.in.includes(c.status)) return false;
          if (where?.timeoutAt?.lte && c.timeoutAt > where.timeoutAt.lte) return false;
          return true;
        });
        return Promise.resolve(results);
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }) => {
        const matches = Array.from(commands.values()).filter(c => {
          if (where.id && c.id !== where.id) return false;
          if (where.status?.in && !where.status.in.includes(c.status)) return false;
          if (where.timeoutAt?.lte && c.timeoutAt > where.timeoutAt.lte) return false;
          return true;
        });
        
        matches.forEach(c => {
          Object.assign(c, data);
        });
        
        return Promise.resolve({ count: matches.length });
      }),
    },
    $transaction: vi.fn(async (fn: any) => fn(mock)),
    _commands: commands,
  };

  return mock as unknown as PrismaClient & { _commands: Map<string, any> };
}

function createMockLogger() {
  return {
    child: vi.fn().mockReturnThis(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;
}

describe('Fleet Management Chaos', () => {
  let prisma: PrismaClient & { _commands: Map<string, any> };
  let logger: Logger;
  let fleetCommander: FleetCommander;
  let commandSender: CommandSender;

  beforeEach(() => {
    vi.useFakeTimers();
    prisma = createMockPrisma();
    logger = createMockLogger();
    commandSender = new CommandSender();
    commandSender.start();

    fleetCommander = new FleetCommander(prisma, logger, {
      defaultTimeoutMs: 5000,
      maxRetries: 2,
      timeoutCheckIntervalMs: 1000,
    });
    fleetCommander.setCommandSender(commandSender);
  });

  afterEach(() => {
    commandSender.stop();
    fleetCommander.stop();
    vi.useRealTimers();
  });

  it('should recover from network partition during command execution (labs-2j5u.12)', async () => {
    const mockWs = new MockWebSocket();
    commandSender.registerConnection(TEST_SENSOR_ID, mockWs as any);

    // 1. Initiate command
    const commandId = await fleetCommander.sendCommand(TEST_TENANT_ID, TEST_SENSOR_ID, {
      type: 'push_config',
      payload: { v: 1 },
    });

    expect(mockWs.sentMessages.length).toBe(1);
    const cmd = prisma._commands.get(commandId);
    expect(cmd.status).toBe('sent');

    // 2. Simulate partition (disconnect)
    mockWs.emit('close');
    
    // 3. Reconnect
    const nextWs = new MockWebSocket();
    commandSender.registerConnection(TEST_SENSOR_ID, nextWs as any);

    // CommandSender should re-enqueue and re-send if not acknowledged
    // However, CommandSender currently doesn't automatically re-send on reconnect
    // if the command was already marked 'sent'. It relies on the higher level retry logic
    // or the protocol level timeout.
    
    // Wait for timeout
    await vi.advanceTimersByTimeAsync(6000);
    
    // FleetCommander timeout checker should mark it as timeout
    const cmdAfterTimeout = prisma._commands.get(commandId);
    expect(cmdAfterTimeout.status).toBe('timeout');
  });

  it('should handle crash recovery scenarios (labs-2j5u.18)', async () => {
    // Simulate a command that was 'sent' but then the service crashed
    const commandId = 'cmd-crashed';
    prisma._commands.set(commandId, {
      id: commandId,
      sensorId: TEST_SENSOR_ID,
      commandType: 'push_config',
      status: 'sent',
      timeoutAt: new Date(Date.now() + 2000), // Times out in 2s
      attempts: 1,
    });

    // Start a new FleetCommander (simulated restart)
    const recoveredCommander = new FleetCommander(prisma, logger, {
      timeoutCheckIntervalMs: 500,
    });

    // Advance time past timeout
    await vi.advanceTimersByTimeAsync(3000);

    const cmd = prisma._commands.get(commandId);
    expect(cmd.status).toBe('timeout');
    
    recoveredCommander.stop();
  });
});
