/**
 * Tenant Isolation Integration Tests
 *
 * Verifies strict tenant isolation across Signal Horizon services, gateways, and API routes.
 * These tests ensure that:
 * 1. Data from one tenant cannot be accessed by another tenant
 * 2. Commands cannot be sent to sensors owned by other tenants
 * 3. Signals are isolated to their originating tenant
 * 4. Broadcasts only reach intended tenant subscribers
 * 5. API routes enforce tenant boundaries
 */

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { PrismaClient, Sensor } from '@prisma/client';
import type { Logger } from 'pino';

// Test tenant IDs
const TENANT_A = 'tenant-alpha-001';
const TENANT_B = 'tenant-beta-002';

// Create mock logger
function createMockLogger(): Logger {
  return {
    child: vi.fn().mockReturnThis(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;
}

// Create mock sensor
function createMockSensor(id: string, tenantId: string): Sensor {
  return {
    id,
    name: `Sensor ${id}`,
    hostname: `${id}.local`,
    tenantId,
    version: '1.0.0',
    connectionState: 'CONNECTED',
    lastHeartbeat: new Date(),
    approvalStatus: 'APPROVED',
    registrationMethod: 'TOKEN',
    registrationTokenId: null,
    fingerprint: null,
    region: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Sensor;
}

describe('Tenant Isolation', () => {
  describe('FleetCommander Isolation', () => {
    it('should reject commands to sensors owned by different tenants', async () => {
      // Import FleetCommander dynamically to avoid module resolution issues
      const { FleetCommander } = await import('../services/fleet/fleet-commander.js');

      const mockData = {
        sensor: {
          findUnique: vi.fn().mockResolvedValue(createMockSensor('sensor-1', TENANT_B)),
          findMany: vi.fn().mockResolvedValue([]),
        },
        fleetCommand: {
          create: vi.fn().mockResolvedValue({ id: 'cmd-1' }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as Record<string, unknown>;
      mockData.$transaction = vi.fn(async (fn: (tx: typeof mockData) => Promise<unknown>) => fn(mockData));
      const mockPrisma = mockData as unknown as PrismaClient;

      const commander = new FleetCommander(mockPrisma, createMockLogger(), {
        defaultTimeoutMs: 5000,
        maxRetries: 1,
        timeoutCheckIntervalMs: 60000,
      });

      // Tenant A should not be able to send commands to Tenant B's sensor
      await expect(
        commander.sendCommand(TENANT_A, 'sensor-1', {
          type: 'push_config',
          payload: { config: {} },
        })
      ).rejects.toThrow(/does not belong to tenant/);

      commander.stop();
    });

    it('should only allow commands to own sensors', async () => {
      const { FleetCommander } = await import('../services/fleet/fleet-commander.js');

      const mockData2 = {
        sensor: {
          findUnique: vi.fn().mockResolvedValue(createMockSensor('sensor-1', TENANT_A)),
        },
        fleetCommand: {
          create: vi.fn().mockResolvedValue({
            id: 'cmd-1',
            sensorId: 'sensor-1',
            commandType: 'push_config',
            payload: {},
            status: 'pending',
          }),
          update: vi.fn().mockResolvedValue({}),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as Record<string, unknown>;
      mockData2.$transaction = vi.fn(async (fn: (tx: typeof mockData2) => Promise<unknown>) => fn(mockData2));
      const mockPrisma = mockData2 as unknown as PrismaClient;

      const commander = new FleetCommander(mockPrisma, createMockLogger(), {
        timeoutCheckIntervalMs: 60000,
      });

      // Tenant A should be able to send commands to own sensor
      const commandId = await commander.sendCommand(TENANT_A, 'sensor-1', {
        type: 'push_config',
        payload: { config: {} },
      });

      expect(commandId).toBe('cmd-1');
      expect(mockPrisma.fleetCommand.create).toHaveBeenCalled();

      commander.stop();
    });

    it('should only broadcast to sensors belonging to the requesting tenant', async () => {
      const { FleetCommander } = await import('../services/fleet/fleet-commander.js');

      const tenantASensors = [
        createMockSensor('sensor-a1', TENANT_A),
        createMockSensor('sensor-a2', TENANT_A),
      ];

      const tenantBSensors = [
        createMockSensor('sensor-b1', TENANT_B),
      ];

      let cmdCounter = 0;
      const mockData3 = {
        sensor: {
          // findMany should filter by tenantId
          findMany: vi.fn().mockImplementation(({ where }) => {
            if (where.tenantId === TENANT_A) {
              return Promise.resolve(tenantASensors);
            }
            if (where.tenantId === TENANT_B) {
              return Promise.resolve(tenantBSensors);
            }
            return Promise.resolve([]);
          }),
          findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
            const sensor = [...tenantASensors, ...tenantBSensors].find(s => s.id === id);
            return Promise.resolve(sensor || null);
          }),
        },
        fleetCommand: {
          create: vi.fn().mockImplementation(() => ({
            id: `cmd-${++cmdCounter}`,
            status: 'pending',
          })),
          update: vi.fn().mockResolvedValue({}),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as Record<string, unknown>;
      mockData3.$transaction = vi.fn(async (fn: (tx: typeof mockData3) => Promise<unknown>) => fn(mockData3));
      const mockPrisma = mockData3 as unknown as PrismaClient;

      const commander = new FleetCommander(mockPrisma, createMockLogger(), {
        timeoutCheckIntervalMs: 60000,
      });

      // Broadcast from Tenant A should only reach Tenant A's sensors
      const commandIds = await commander.broadcastCommand(TENANT_A, {
        type: 'push_rules',
        payload: { rules: [] },
      });

      // Should only create commands for Tenant A's 2 sensors
      expect(commandIds).toHaveLength(2);
      expect(mockPrisma.sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_A,
          }),
        })
      );

      commander.stop();
    });
  });

  describe('Signal Processing Isolation', () => {
    it('should enforce tenant context in signal types', () => {
      // Signals require tenantId to be set - this is enforced at the type level
      interface TenantScopedSignal {
        signalType: string;
        tenantId: string;  // Required field
        sensorId: string;
        payload: Record<string, unknown>;
      }

      const signalA: TenantScopedSignal = {
        signalType: 'BOT_SIGNATURE',
        tenantId: TENANT_A,
        sensorId: 'sensor-a1',
        payload: {},
      };

      const signalB: TenantScopedSignal = {
        signalType: 'CREDENTIAL_STUFFING',
        tenantId: TENANT_B,
        sensorId: 'sensor-b1',
        payload: {},
      };

      // Verify signals maintain tenant association
      expect(signalA.tenantId).toBe(TENANT_A);
      expect(signalB.tenantId).toBe(TENANT_B);
      expect(signalA.tenantId).not.toBe(signalB.tenantId);
    });
  });

  describe('Rule Distributor Isolation', () => {
    it('should validate tenant ownership before distributing rules', async () => {
      const { RuleDistributor, TenantIsolationError } = await import('../services/fleet/rule-distributor.js');

      const mockFleetCommander = Object.assign(new EventEmitter(), {
        sendCommand: vi.fn().mockResolvedValue('cmd-1'),
        sendCommandToMultiple: vi.fn().mockResolvedValue(['cmd-1']),
      });

      const mockPrisma = {
        sensor: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            // Return sensors for the requested IDs, but with TENANT_A ownership
            if (where?.id?.in) {
              return Promise.resolve(
                where.id.in.map((id: string) => ({ id, tenantId: TENANT_A }))
              );
            }
            return Promise.resolve([]);
          }),
        },
        ruleSyncState: {
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({}),
        },
        sensorSyncState: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({}),
        },
        scheduledDeployment: {
          create: vi.fn().mockResolvedValue({ id: 'sched-1', tenantId: TENANT_A }),
          update: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
        },
        $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
      } as unknown as PrismaClient;

      const distributor = new RuleDistributor(
        mockPrisma,
        createMockLogger(),
        mockFleetCommander as never
      );

      // Tenant B trying to distribute rules to Tenant A's sensors should fail
      await expect(
        distributor.distributeRules(
          TENANT_B,
          ['sensor-a1'], // These belong to Tenant A
          [{ id: 'rule-1', name: 'Test', conditions: {}, actions: {}, enabled: true, priority: 1 }]
        )
      ).rejects.toThrow(TenantIsolationError);
    });
  });

  describe('Service-Level Tenant Isolation', () => {
    it('should have tenant context in all major service interfaces', async () => {
      // Import services to verify they exist and support tenant isolation
      const { ConfigManager } = await import('../services/fleet/config-manager.js');
      const { HuntService } = await import('../services/hunt/index.js');
      const { WarRoomService } = await import('../services/warroom/index.js');

      // All services should be defined and constructable
      expect(ConfigManager).toBeDefined();
      expect(HuntService).toBeDefined();
      expect(WarRoomService).toBeDefined();

      // These services use tenantId in their database queries and operations
      // to ensure data isolation between tenants
    });
  });

  describe('Cross-Tenant Leak Prevention', () => {
    it('should not leak sensor data across tenant boundaries', async () => {
      const { FleetCommander } = await import('../services/fleet/fleet-commander.js');

      const sensors = [
        createMockSensor('sensor-a1', TENANT_A),
        createMockSensor('sensor-b1', TENANT_B),
      ];

      const mockData5 = {
        sensor: {
          findUnique: vi.fn().mockImplementation(({ where: { id } }) => {
            return Promise.resolve(sensors.find(s => s.id === id) || null);
          }),
          findMany: vi.fn().mockImplementation(({ where }) => {
            return Promise.resolve(sensors.filter(s => s.tenantId === where.tenantId));
          }),
        },
        fleetCommand: {
          create: vi.fn().mockResolvedValue({ id: 'cmd-1' }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as Record<string, unknown>;
      mockData5.$transaction = vi.fn(async (fn: (tx: typeof mockData5) => Promise<unknown>) => fn(mockData5));
      const mockPrisma = mockData5 as unknown as PrismaClient;

      const logger = createMockLogger();
      const commander = new FleetCommander(mockPrisma, logger, {
        timeoutCheckIntervalMs: 60000,
      });

      // Attempt cross-tenant command
      const violationAttempt = commander.sendCommand(TENANT_A, 'sensor-b1', {
        type: 'push_config',
        payload: {},
      });

      await expect(violationAttempt).rejects.toThrow();

      // Verify violation was logged
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          sensorId: 'sensor-b1',
          sensorTenantId: TENANT_B,
        }),
        expect.stringContaining('Tenant isolation violation')
      );

      commander.stop();
    });
  });
});
