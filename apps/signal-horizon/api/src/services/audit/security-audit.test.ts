/**
 * Security Audit Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import type { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { SecurityAuditService } from './security-audit.js';

describe('SecurityAuditService', () => {
  let service: SecurityAuditService;
  let mockPrisma: {
    auditLog: { create: ReturnType<typeof vi.fn> };
  };
  const logger = pino({ level: 'silent' });

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    service = new SecurityAuditService(mockPrisma as unknown as PrismaClient, logger);
  });

  const createMockRequest = (overrides: Partial<Request> = {}): Request => {
    return {
      auth: { userId: 'user-123', tenantId: 'tenant-abc' },
      id: 'req-uuid-456',
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'TestAgent/1.0',
      },
      get: vi.fn((header: string) => {
        if (header.toLowerCase() === 'user-agent') return 'TestAgent/1.0';
        return undefined;
      }),
      ...overrides,
    } as unknown as Request;
  };

  describe('extractRequestContext', () => {
    it('should extract full context including requestId', () => {
      const req = createMockRequest();

      const context = service.extractRequestContext(req);

      expect(context.userId).toBe('user-123');
      expect(context.tenantId).toBe('tenant-abc');
      expect(context.requestId).toBe('req-uuid-456');
      expect(context.ipAddress).toBe('192.168.1.1');
      expect(context.userAgent).toBe('TestAgent/1.0');
    });

    it('should handle missing requestId', () => {
      const req = createMockRequest({ id: undefined });

      const context = service.extractRequestContext(req);

      expect(context.requestId).toBeNull();
    });

    it('should use X-Forwarded-For header when present', () => {
      const req = createMockRequest({
        headers: {
          'x-forwarded-for': '10.0.0.1, 10.0.0.2',
          'user-agent': 'TestAgent/1.0',
        },
      });

      const context = service.extractRequestContext(req);

      expect(context.ipAddress).toBe('10.0.0.1');
    });
  });

  describe('redactSensitiveValues', () => {
    it('should redact password fields', () => {
      const config = {
        username: 'admin',
        password: 'secret123',
        dbPassword: 'dbsecret',
      };

      const result = service.redactSensitiveValues(config);

      expect(result.username).toBe('admin');
      expect(result.password).toBe('[REDACTED]');
      expect(result.dbPassword).toBe('[REDACTED]');
    });

    it('should redact token and key fields', () => {
      const config = {
        endpoint: 'https://api.example.com',
        apiKey: 'sk-1234567890',
        accessToken: 'eyJhbGciOiJIUzI1NiJ9...',
        refreshToken: 'refresh-token-value',
      };

      const result = service.redactSensitiveValues(config);

      expect(result.endpoint).toBe('https://api.example.com');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.accessToken).toBe('[REDACTED]');
      expect(result.refreshToken).toBe('[REDACTED]');
    });

    it('should redact nested sensitive fields', () => {
      const config = {
        database: {
          host: 'localhost',
          port: 5432,
          connection: {
            username: 'admin',
            password: 'secret',
          },
        },
      };

      const result = service.redactSensitiveValues(config);

      expect((result.database as Record<string, unknown>).host).toBe('localhost');
      expect((result.database as Record<string, unknown>).port).toBe(5432);
      const connection = (result.database as Record<string, unknown>).connection as Record<string, unknown>;
      expect(connection.username).toBe('admin');
      expect(connection.password).toBe('[REDACTED]');
    });

    it('should redact sensitive fields in arrays', () => {
      const config = {
        connections: [
          { name: 'primary', apiKey: 'key1' },
          { name: 'secondary', apiKey: 'key2' },
        ],
      };

      const result = service.redactSensitiveValues(config);

      const connections = result.connections as Record<string, unknown>[];
      expect(connections[0].name).toBe('primary');
      expect(connections[0].apiKey).toBe('[REDACTED]');
      expect(connections[1].name).toBe('secondary');
      expect(connections[1].apiKey).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive primitive arrays', () => {
      const config = {
        tags: ['tag1', 'tag2'],
        ports: [80, 443],
      };

      const result = service.redactSensitiveValues(config);

      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.ports).toEqual([80, 443]);
    });
  });

  describe('computeConfigDiff', () => {
    it('should detect changed fields', () => {
      const prev = { name: 'old', timeout: 30 };
      const curr = { name: 'new', timeout: 30 };

      const diff = service.computeConfigDiff(prev, curr);

      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        field: 'name',
        previousValue: 'old',
        newValue: 'new',
      });
    });

    it('should detect added fields', () => {
      const prev = { name: 'config' };
      const curr = { name: 'config', enabled: true };

      const diff = service.computeConfigDiff(prev, curr);

      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        field: 'enabled',
        previousValue: undefined,
        newValue: true,
      });
    });

    it('should detect removed fields', () => {
      const prev = { name: 'config', enabled: true };
      const curr = { name: 'config' };

      const diff = service.computeConfigDiff(prev, curr);

      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        field: 'enabled',
        previousValue: true,
        newValue: undefined,
      });
    });

    it('should redact sensitive field values in diff', () => {
      const prev = { apiKey: 'old-key', endpoint: 'http://old' };
      const curr = { apiKey: 'new-key', endpoint: 'http://new' };

      const diff = service.computeConfigDiff(prev, curr);

      expect(diff).toHaveLength(2);
      const apiKeyChange = diff.find((d) => d.field === 'apiKey');
      expect(apiKeyChange?.previousValue).toBe('[REDACTED]');
      expect(apiKeyChange?.newValue).toBe('[REDACTED]');

      const endpointChange = diff.find((d) => d.field === 'endpoint');
      expect(endpointChange?.previousValue).toBe('http://old');
      expect(endpointChange?.newValue).toBe('http://new');
    });
  });

  describe('logConfigCreated', () => {
    it('should log config creation with redacted values', async () => {
      const req = createMockRequest();
      const config = {
        name: 'new-sensor',
        apiKey: 'secret-key',
        enabled: true,
      };

      await service.logConfigCreated(req, 'sensor', 'sensor-123', config);

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.action).toBe('CONFIG_CREATED');
      expect(callArgs.data.tenantId).toBe('tenant-abc');
      expect(callArgs.data.userId).toBe('user-123');
      expect(callArgs.data.resourceId).toBe('sensor-123');

      // Details contain the full event structure
      const details = callArgs.data.details;
      expect(details.details.resourceType).toBe('sensor');
      expect(details.details.newValues).toEqual({
        name: 'new-sensor',
        apiKey: '[REDACTED]',
        enabled: true,
      });
    });
  });

  describe('logConfigUpdated', () => {
    it('should log config update with computed diff', async () => {
      const req = createMockRequest();
      const prev = { timeout: 30, retries: 3 };
      const curr = { timeout: 60, retries: 3 };

      await service.logConfigUpdated(req, 'fleet', 'fleet-456', prev, curr);

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.action).toBe('CONFIG_UPDATED');
      expect(callArgs.data.resourceId).toBe('fleet-456');

      const details = callArgs.data.details;
      expect(details.details.resourceType).toBe('fleet');
      expect(details.details.changeCount).toBe(1);
      expect(details.details.changes).toEqual([
        { field: 'timeout', previousValue: 30, newValue: 60 },
      ]);
    });
  });

  describe('logConfigDeleted', () => {
    it('should log config deletion', async () => {
      const req = createMockRequest();

      await service.logConfigDeleted(req, 'rule', 'rule-789');

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.action).toBe('CONFIG_DELETED');
      expect(callArgs.data.resourceId).toBe('rule-789');
      expect(callArgs.data.details.details.resourceType).toBe('rule');
    });

    it('should include redacted previous values if provided', async () => {
      const req = createMockRequest();
      const previousConfig = { name: 'deleted-rule', secretKey: 'hidden' };

      await service.logConfigDeleted(req, 'rule', 'rule-789', previousConfig);

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.details.details.previousValues).toEqual({
        name: 'deleted-rule',
        secretKey: '[REDACTED]',
      });
    });
  });

  describe('requestId integration', () => {
    it('should include requestId in logged event details', async () => {
      const req = createMockRequest({ id: 'trace-id-123' });

      await service.logConfigCreated(req, 'sensor', 'sensor-1', { name: 'test' });

      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      const callArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(callArgs.data.details.requestId).toBe('trace-id-123');
    });
  });
});
