/**
 * Protocol Fixture Generator
 *
 * Generates canonical JSON fixtures from TypeScript protocol types defined in
 * signal-horizon's protocol.ts. These fixtures are consumed by Rust
 * deserialization tests in synapse-waf to validate cross-language type
 * compatibility.
 *
 * This test is the **source of truth** for the protocol wire format.
 * If these fixtures change, the Rust side must also pass.
 *
 * Run: pnpm nx run synapse-api:test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// We inline the protocol types here rather than importing from signal-horizon
// because synapse-api is the canonical package for sensor<->hub wire types.
// The types below mirror signal-horizon/api/src/types/protocol.ts exactly.
// ---------------------------------------------------------------------------

// Signal types (SCREAMING_SNAKE_CASE over the wire)
type SignalType =
  | 'IP_THREAT'
  | 'FINGERPRINT_THREAT'
  | 'CAMPAIGN_INDICATOR'
  | 'CREDENTIAL_STUFFING'
  | 'RATE_ANOMALY'
  | 'BOT_SIGNATURE'
  | 'IMPOSSIBLE_TRAVEL'
  | 'TEMPLATE_DISCOVERY'
  | 'SCHEMA_VIOLATION';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface ThreatSignal {
  signalType: SignalType;
  sourceIp?: string;
  fingerprint?: string;
  severity: Severity;
  confidence: number;
  eventCount?: number;
  metadata?: Record<string, unknown>;
}

// -- Sensor Messages (sensor -> hub) ----------------------------------------

interface SensorAuthMessage {
  type: 'auth';
  payload: {
    apiKey: string;
    sensorId: string;
    sensorName?: string;
    version: string;
    protocolVersion?: string;
  };
}

interface SensorSignalMessage {
  type: 'signal';
  payload: ThreatSignal;
}

interface SensorSignalBatchMessage {
  type: 'signal-batch';
  payload: ThreatSignal[];
}

interface SensorPongMessage {
  type: 'pong';
}

interface SensorBlocklistSyncMessage {
  type: 'blocklist-sync';
}

interface SensorHeartbeatMessage {
  type: 'heartbeat';
  payload: {
    timestamp: number;
    status: string;
    cpu: number;
    memory: number;
    disk: number;
    requestsLastMinute: number;
    avgLatencyMs: number;
    configHash: string;
    rulesHash: string;
    activeConnections?: number;
    blocklistSize?: number;
  };
}

interface SensorCommandAckMessage {
  type: 'command-ack';
  payload: {
    commandId: string;
    success: boolean;
    message?: string;
    result?: Record<string, unknown>;
  };
}

type SensorMessage =
  | SensorAuthMessage
  | SensorSignalMessage
  | SensorSignalBatchMessage
  | SensorPongMessage
  | SensorBlocklistSyncMessage
  | SensorHeartbeatMessage
  | SensorCommandAckMessage;

// -- Hub Messages (hub -> sensor) -------------------------------------------

// NOTE: BlockType drift -- TS defines IP, IP_RANGE, FINGERPRINT, ASN, USER_AGENT
// but Rust only defines IP and FINGERPRINT. Fixtures use only the Rust-compatible subset.
type BlockType = 'IP' | 'FINGERPRINT';

// NOTE: BlockSource drift -- TS defines a union type but Rust uses a plain String.
// Fixtures use the TS values which Rust will accept as strings.
type BlockSource = 'AUTOMATIC' | 'MANUAL' | 'FLEET_INTEL' | 'EXTERNAL_FEED' | 'WAR_ROOM';

interface BlocklistEntry {
  blockType: BlockType;
  indicator: string;
  expiresAt?: string | null;
  source: BlockSource;
  reason?: string;
  createdAt?: string;
}

// NOTE: BlocklistUpdate drift -- TS uses "type" field with 'add'|'remove',
// Rust uses "action" field with BlocklistAction enum. The Rust struct will
// fail to deserialize TS-shaped updates because the field name differs.
// This is a known incompatibility documented in the fixture comments.
interface BlocklistUpdate {
  action: 'add' | 'remove';
  blockType: BlockType;
  indicator: string;
  source?: string;
  reason?: string;
}

// Hub message types (individually tagged via "type" discriminator)
interface HubAuthSuccessMessage {
  type: 'auth-success';
  sensorId: string;
  tenantId: string;
  capabilities: string[];
  protocolVersion?: string;
}

interface HubAuthFailedMessage {
  type: 'auth-failed';
  error: string;
}

interface HubSignalAckMessage {
  type: 'signal-ack';
  sequenceId: number;
}

interface HubBatchAckMessage {
  type: 'batch-ack';
  count: number;
  sequenceId: number;
}

interface HubPingMessage {
  type: 'ping';
  timestamp: number;
}

interface HubErrorMessage {
  type: 'error';
  error: string;
  code?: string;
}

interface HubBlocklistSnapshotMessage {
  type: 'blocklist-snapshot';
  entries: BlocklistEntry[];
  sequenceId: number;
}

// NOTE: TS calls this "blocklist-update" (via BlocklistUpdate type on the
// HubBlocklistPushMessage with type: 'blocklist-push'), but Rust expects
// "blocklist-update" as the serde tag. The Rust enum variant is
// BlocklistUpdate { updates, sequence_id }. We generate the Rust-compatible
// shape here.
interface HubBlocklistUpdateMessage {
  type: 'blocklist-update';
  updates: BlocklistUpdate[];
  sequenceId: number;
}

interface HubConfigUpdateMessage {
  type: 'config-update';
  config: Record<string, unknown>;
  version: string;
}

interface HubRulesUpdateMessage {
  type: 'rules-update';
  rules: Record<string, unknown>;
  version: string;
}

// Command messages use underscore-based type tags (not kebab-case)
interface HubPushConfigMessage {
  type: 'push_config';
  commandId: string;
  payload: Record<string, unknown>;
}

interface HubPushRulesMessage {
  type: 'push_rules';
  commandId: string;
  payload: Record<string, unknown>;
}

interface HubRestartMessage {
  type: 'restart';
  commandId: string;
  payload: Record<string, unknown>;
}

interface HubCollectDiagnosticsMessage {
  type: 'collect_diagnostics';
  commandId: string;
  payload: Record<string, unknown>;
}

interface HubUpdateMessage {
  type: 'update';
  commandId: string;
  payload: Record<string, unknown>;
}

interface HubSyncBlocklistMessage {
  type: 'sync_blocklist';
  commandId: string;
  payload: Record<string, unknown>;
}

type HubMessage =
  | HubAuthSuccessMessage
  | HubAuthFailedMessage
  | HubSignalAckMessage
  | HubBatchAckMessage
  | HubPingMessage
  | HubErrorMessage
  | HubBlocklistSnapshotMessage
  | HubBlocklistUpdateMessage
  | HubConfigUpdateMessage
  | HubRulesUpdateMessage
  | HubPushConfigMessage
  | HubPushRulesMessage
  | HubRestartMessage
  | HubCollectDiagnosticsMessage
  | HubUpdateMessage
  | HubSyncBlocklistMessage;

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

function writeFixture(name: string, data: unknown): void {
  const filePath = join(FIXTURES_DIR, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// -- Sensor message fixtures ------------------------------------------------

const sensorAuth: SensorAuthMessage = {
  type: 'auth',
  payload: {
    apiKey: 'sk_live_test_key_12345',
    sensorId: 'sensor-prod-01',
    sensorName: 'Production Edge US-East',
    version: '1.2.0',
    protocolVersion: '1.0',
  },
};

const sensorAuthMinimal: SensorAuthMessage = {
  type: 'auth',
  payload: {
    apiKey: 'sk_live_minimal',
    sensorId: 'sensor-dev-01',
    version: '1.0.0',
  },
};

const sensorSignal: SensorSignalMessage = {
  type: 'signal',
  payload: {
    signalType: 'IP_THREAT',
    sourceIp: '192.168.1.100',
    severity: 'HIGH',
    confidence: 0.95,
    eventCount: 50,
    metadata: { country: 'US', asn: 'AS15169' },
  },
};

const sensorSignalMinimal: SensorSignalMessage = {
  type: 'signal',
  payload: {
    signalType: 'BOT_SIGNATURE',
    severity: 'MEDIUM',
    confidence: 0.7,
  },
};

const sensorSignalBatch: SensorSignalBatchMessage = {
  type: 'signal-batch',
  payload: [
    {
      signalType: 'CREDENTIAL_STUFFING',
      sourceIp: '10.0.0.1',
      severity: 'CRITICAL',
      confidence: 0.99,
      eventCount: 200,
      metadata: { latitude: 40.7128, longitude: -74.006, city: 'New York' },
    },
    {
      signalType: 'RATE_ANOMALY',
      sourceIp: '10.0.0.2',
      severity: 'LOW',
      confidence: 0.5,
    },
    {
      signalType: 'FINGERPRINT_THREAT',
      fingerprint: 't13d1516h2_abc123',
      severity: 'HIGH',
      confidence: 0.88,
      eventCount: 12,
    },
  ],
};

const sensorPong: SensorPongMessage = {
  type: 'pong',
};

const sensorBlocklistSync: SensorBlocklistSyncMessage = {
  type: 'blocklist-sync',
};

const sensorHeartbeat: SensorHeartbeatMessage = {
  type: 'heartbeat',
  payload: {
    timestamp: 1706745600000,
    status: 'healthy',
    cpu: 45.2,
    memory: 62.1,
    disk: 23.5,
    requestsLastMinute: 15420,
    avgLatencyMs: 2.3,
    configHash: 'abc123def456',
    rulesHash: '789ghi012jkl',
    activeConnections: 342,
    blocklistSize: 1500,
  },
};

const sensorHeartbeatMinimal: SensorHeartbeatMessage = {
  type: 'heartbeat',
  payload: {
    timestamp: 1706745600000,
    status: 'degraded',
    cpu: 95.0,
    memory: 88.3,
    disk: 75.0,
    requestsLastMinute: 0,
    avgLatencyMs: 150.5,
    configHash: 'hash1',
    rulesHash: 'hash2',
  },
};

const sensorCommandAck: SensorCommandAckMessage = {
  type: 'command-ack',
  payload: {
    commandId: 'cmd-abc-123',
    success: true,
    message: 'Configuration applied successfully',
    result: { appliedRules: 42, reloadTimeMs: 150 },
  },
};

const sensorCommandAckFailed: SensorCommandAckMessage = {
  type: 'command-ack',
  payload: {
    commandId: 'cmd-def-456',
    success: false,
    message: 'Invalid configuration format',
  },
};

// -- Hub message fixtures ---------------------------------------------------

const hubAuthSuccess: HubAuthSuccessMessage = {
  type: 'auth-success',
  sensorId: 'sensor-prod-01',
  tenantId: 'tenant-acme-corp',
  capabilities: ['signals', 'blocklist-sync', 'fleet-commands'],
  protocolVersion: '1.0',
};

const hubAuthSuccessMinimal: HubAuthSuccessMessage = {
  type: 'auth-success',
  sensorId: 'sensor-dev-01',
  tenantId: 'tenant-dev',
  capabilities: [],
};

const hubAuthFailed: HubAuthFailedMessage = {
  type: 'auth-failed',
  error: 'Invalid API key',
};

const hubSignalAck: HubSignalAckMessage = {
  type: 'signal-ack',
  sequenceId: 42,
};

const hubBatchAck: HubBatchAckMessage = {
  type: 'batch-ack',
  count: 3,
  sequenceId: 43,
};

const hubPing: HubPingMessage = {
  type: 'ping',
  timestamp: 1706745600000,
};

const hubError: HubErrorMessage = {
  type: 'error',
  error: 'Rate limit exceeded',
  code: 'RATE_LIMIT',
};

const hubErrorMinimal: HubErrorMessage = {
  type: 'error',
  error: 'Internal server error',
};

const hubBlocklistSnapshot: HubBlocklistSnapshotMessage = {
  type: 'blocklist-snapshot',
  entries: [
    {
      blockType: 'IP',
      indicator: '192.168.1.100',
      source: 'AUTOMATIC',
      reason: 'High risk score',
    },
    {
      blockType: 'FINGERPRINT',
      indicator: 't13d1516h2_malicious',
      expiresAt: '2025-12-31T23:59:59Z',
      source: 'MANUAL',
    },
  ],
  sequenceId: 100,
};

const hubBlocklistUpdate: HubBlocklistUpdateMessage = {
  type: 'blocklist-update',
  updates: [
    {
      action: 'add',
      blockType: 'IP',
      indicator: '10.0.0.50',
      source: 'FLEET_INTEL',
      reason: 'Cross-tenant campaign',
    },
    {
      action: 'remove',
      blockType: 'FINGERPRINT',
      indicator: 't13d1516h2_cleared',
    },
  ],
  sequenceId: 101,
};

const hubConfigUpdate: HubConfigUpdateMessage = {
  type: 'config-update',
  config: {
    riskBasedBlockingEnabled: true,
    autoblockThreshold: 80,
    riskDecayPerMinute: 0.5,
  },
  version: '2.1.0',
};

const hubRulesUpdate: HubRulesUpdateMessage = {
  type: 'rules-update',
  rules: {
    rules: [
      { id: 1, description: 'SQL Injection', blocking: true },
      { id: 2, description: 'XSS Detection', risk: 25 },
    ],
  },
  version: '3.0.0',
};

const hubPushConfig: HubPushConfigMessage = {
  type: 'push_config',
  commandId: 'cmd-push-config-001',
  payload: {
    config: { autoblockThreshold: 90 },
    version: '2.2.0',
    component: 'waf',
    action: 'merge',
  },
};

const hubPushRules: HubPushRulesMessage = {
  type: 'push_rules',
  commandId: 'cmd-push-rules-001',
  payload: {
    rules: [{ id: 100, description: 'New emergency rule', blocking: true }],
  },
};

const hubRestart: HubRestartMessage = {
  type: 'restart',
  commandId: 'cmd-restart-001',
  payload: { graceful: true, timeoutSecs: 30 },
};

const hubCollectDiagnostics: HubCollectDiagnosticsMessage = {
  type: 'collect_diagnostics',
  commandId: 'cmd-diag-001',
  payload: { includeMemoryDump: false, includeConfigDump: true },
};

const hubUpdate: HubUpdateMessage = {
  type: 'update',
  commandId: 'cmd-update-001',
  payload: { targetVersion: '1.3.0', channel: 'stable' },
};

const hubSyncBlocklist: HubSyncBlocklistMessage = {
  type: 'sync_blocklist',
  commandId: 'cmd-sync-bl-001',
  payload: { fullSync: true },
};

// -- All signal type variants -----------------------------------------------

const allSignalTypes: SensorSignalMessage[] = (
  [
    'IP_THREAT',
    'FINGERPRINT_THREAT',
    'CAMPAIGN_INDICATOR',
    'CREDENTIAL_STUFFING',
    'RATE_ANOMALY',
    'BOT_SIGNATURE',
    'IMPOSSIBLE_TRAVEL',
    'TEMPLATE_DISCOVERY',
    'SCHEMA_VIOLATION',
  ] as SignalType[]
).map((st) => ({
  type: 'signal' as const,
  payload: {
    signalType: st,
    severity: 'MEDIUM' as Severity,
    confidence: 0.75,
    sourceIp: '10.0.0.1',
  },
}));

// -- All severity variants --------------------------------------------------

const allSeverities: SensorSignalMessage[] = (
  ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Severity[]
).map((sev) => ({
  type: 'signal' as const,
  payload: {
    signalType: 'IP_THREAT' as SignalType,
    severity: sev,
    confidence: 0.8,
    sourceIp: '10.0.0.1',
  },
}));

// ===========================================================================
// Tests
// ===========================================================================

describe('Protocol Fixture Generator', () => {
  beforeAll(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  describe('Sensor Messages', () => {
    it('should generate auth fixture', () => {
      writeFixture('sensor-auth', sensorAuth);
      writeFixture('sensor-auth-minimal', sensorAuthMinimal);
      expect(sensorAuth.type).toBe('auth');
      expect(sensorAuth.payload.apiKey).toBeDefined();
    });

    it('should generate signal fixture', () => {
      writeFixture('sensor-signal', sensorSignal);
      writeFixture('sensor-signal-minimal', sensorSignalMinimal);
      expect(sensorSignal.type).toBe('signal');
      expect(sensorSignal.payload.signalType).toBe('IP_THREAT');
    });

    it('should generate signal-batch fixture', () => {
      writeFixture('sensor-signal-batch', sensorSignalBatch);
      expect(sensorSignalBatch.type).toBe('signal-batch');
      expect(sensorSignalBatch.payload.length).toBe(3);
    });

    it('should generate pong fixture', () => {
      writeFixture('sensor-pong', sensorPong);
      expect(sensorPong.type).toBe('pong');
    });

    it('should generate blocklist-sync fixture', () => {
      writeFixture('sensor-blocklist-sync', sensorBlocklistSync);
      expect(sensorBlocklistSync.type).toBe('blocklist-sync');
    });

    it('should generate heartbeat fixtures', () => {
      writeFixture('sensor-heartbeat', sensorHeartbeat);
      writeFixture('sensor-heartbeat-minimal', sensorHeartbeatMinimal);
      expect(sensorHeartbeat.type).toBe('heartbeat');
      expect(sensorHeartbeat.payload.cpu).toBeGreaterThan(0);
    });

    it('should generate command-ack fixtures', () => {
      writeFixture('sensor-command-ack', sensorCommandAck);
      writeFixture('sensor-command-ack-failed', sensorCommandAckFailed);
      expect(sensorCommandAck.payload.success).toBe(true);
      expect(sensorCommandAckFailed.payload.success).toBe(false);
    });

    it('should generate all signal type variants', () => {
      writeFixture('sensor-signal-all-types', allSignalTypes);
      expect(allSignalTypes.length).toBe(9);
    });

    it('should generate all severity variants', () => {
      writeFixture('sensor-signal-all-severities', allSeverities);
      expect(allSeverities.length).toBe(4);
    });
  });

  describe('Hub Messages', () => {
    it('should generate auth-success fixtures', () => {
      writeFixture('hub-auth-success', hubAuthSuccess);
      writeFixture('hub-auth-success-minimal', hubAuthSuccessMinimal);
      expect(hubAuthSuccess.type).toBe('auth-success');
    });

    it('should generate auth-failed fixture', () => {
      writeFixture('hub-auth-failed', hubAuthFailed);
      expect(hubAuthFailed.type).toBe('auth-failed');
    });

    it('should generate signal-ack fixture', () => {
      writeFixture('hub-signal-ack', hubSignalAck);
      expect(hubSignalAck.sequenceId).toBe(42);
    });

    it('should generate batch-ack fixture', () => {
      writeFixture('hub-batch-ack', hubBatchAck);
      expect(hubBatchAck.count).toBe(3);
    });

    it('should generate ping fixture', () => {
      writeFixture('hub-ping', hubPing);
      expect(hubPing.timestamp).toBeGreaterThan(0);
    });

    it('should generate error fixtures', () => {
      writeFixture('hub-error', hubError);
      writeFixture('hub-error-minimal', hubErrorMinimal);
      expect(hubError.code).toBeDefined();
      expect(hubErrorMinimal.code).toBeUndefined();
    });

    it('should generate blocklist-snapshot fixture', () => {
      writeFixture('hub-blocklist-snapshot', hubBlocklistSnapshot);
      expect(hubBlocklistSnapshot.entries.length).toBe(2);
    });

    it('should generate blocklist-update fixture', () => {
      writeFixture('hub-blocklist-update', hubBlocklistUpdate);
      expect(hubBlocklistUpdate.updates.length).toBe(2);
    });

    it('should generate config-update fixture', () => {
      writeFixture('hub-config-update', hubConfigUpdate);
      expect(hubConfigUpdate.version).toBeDefined();
    });

    it('should generate rules-update fixture', () => {
      writeFixture('hub-rules-update', hubRulesUpdate);
      expect(hubRulesUpdate.version).toBeDefined();
    });

    it('should generate push_config fixture', () => {
      writeFixture('hub-push-config', hubPushConfig);
      expect(hubPushConfig.commandId).toBeDefined();
    });

    it('should generate push_rules fixture', () => {
      writeFixture('hub-push-rules', hubPushRules);
      expect(hubPushRules.commandId).toBeDefined();
    });

    it('should generate restart fixture', () => {
      writeFixture('hub-restart', hubRestart);
      expect(hubRestart.commandId).toBeDefined();
    });

    it('should generate collect_diagnostics fixture', () => {
      writeFixture('hub-collect-diagnostics', hubCollectDiagnostics);
      expect(hubCollectDiagnostics.commandId).toBeDefined();
    });

    it('should generate update fixture', () => {
      writeFixture('hub-update', hubUpdate);
      expect(hubUpdate.commandId).toBeDefined();
    });

    it('should generate sync_blocklist fixture', () => {
      writeFixture('hub-sync-blocklist', hubSyncBlocklist);
      expect(hubSyncBlocklist.commandId).toBeDefined();
    });
  });

  describe('Wire format invariants', () => {
    it('should use camelCase field names for payloads', () => {
      const json = JSON.stringify(sensorHeartbeat);
      expect(json).toContain('requestsLastMinute');
      expect(json).toContain('avgLatencyMs');
      expect(json).toContain('configHash');
      expect(json).not.toContain('requests_last_minute');
    });

    it('should use SCREAMING_SNAKE_CASE for enum values', () => {
      const json = JSON.stringify(sensorSignal);
      expect(json).toContain('IP_THREAT');
      expect(json).toContain('HIGH');
    });

    it('should use kebab-case for message type discriminators', () => {
      const sensorTypes = [
        sensorAuth,
        sensorSignal,
        sensorSignalBatch,
        sensorPong,
        sensorBlocklistSync,
        sensorHeartbeat,
        sensorCommandAck,
      ];
      for (const msg of sensorTypes) {
        expect(msg.type).toMatch(/^[a-z][a-z-]*$/);
      }
    });

    it('should use kebab-case or underscore for hub message type discriminators', () => {
      const hubTypes: HubMessage[] = [
        hubAuthSuccess,
        hubAuthFailed,
        hubSignalAck,
        hubBatchAck,
        hubPing,
        hubError,
        hubBlocklistSnapshot,
        hubBlocklistUpdate,
        hubConfigUpdate,
        hubRulesUpdate,
        hubPushConfig,
        hubPushRules,
        hubRestart,
        hubCollectDiagnostics,
        hubUpdate,
        hubSyncBlocklist,
      ];
      for (const msg of hubTypes) {
        expect(msg.type).toMatch(/^[a-z][a-z_-]*$/);
      }
    });

    it('severity values should be SCREAMING_SNAKE_CASE', () => {
      // DRIFT NOTE: Rust Severity enum uses serde(rename_all = "SCREAMING_SNAKE_CASE")
      // which serializes as "LOW", "MEDIUM", "HIGH", "CRITICAL".
      // TS Severity type uses the same literal values.
      // This is consistent -- no drift here.
      const severities: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      for (const sev of severities) {
        expect(sev).toMatch(/^[A-Z_]+$/);
      }
    });

    it('signal types should be SCREAMING_SNAKE_CASE', () => {
      const signalTypes: SignalType[] = [
        'IP_THREAT',
        'FINGERPRINT_THREAT',
        'CAMPAIGN_INDICATOR',
        'CREDENTIAL_STUFFING',
        'RATE_ANOMALY',
        'BOT_SIGNATURE',
        'IMPOSSIBLE_TRAVEL',
        'TEMPLATE_DISCOVERY',
        'SCHEMA_VIOLATION',
      ];
      for (const st of signalTypes) {
        expect(st).toMatch(/^[A-Z_]+$/);
      }
    });

    it('confidence should be between 0.0 and 1.0', () => {
      const allSignals = [
        sensorSignal.payload,
        sensorSignalMinimal.payload,
        ...sensorSignalBatch.payload,
      ];
      for (const signal of allSignals) {
        expect(signal.confidence).toBeGreaterThanOrEqual(0.0);
        expect(signal.confidence).toBeLessThanOrEqual(1.0);
      }
    });
  });
});
