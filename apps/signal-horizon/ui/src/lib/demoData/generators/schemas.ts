/**
 * Schema Changes Demo Data Generator
 *
 * Generates SchemaChange[] for different scenarios.
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type { SchemaChange, RiskLevel } from '../../../types/beam';
import { getScenarioProfile, BASELINE } from '../scenarios';

// Field name pools for realistic schema changes
const FIELD_POOLS = {
  sensitive: [
    'password',
    'ssn',
    'credit_card',
    'api_key',
    'token',
    'secret',
    'private_key',
    'auth_token',
    'session_id',
    'access_token',
  ],
  pii: [
    'email',
    'phone',
    'address',
    'date_of_birth',
    'full_name',
    'user_id',
    'account_number',
    'ip_address',
  ],
  normal: [
    'id',
    'created_at',
    'updated_at',
    'name',
    'description',
    'status',
    'type',
    'count',
    'metadata',
    'tags',
    'version',
    'enabled',
  ],
};

const TYPE_CHANGES = [
  { from: 'string', to: 'integer' },
  { from: 'integer', to: 'string' },
  { from: 'boolean', to: 'string' },
  { from: 'object', to: 'array' },
  { from: 'string', to: 'object' },
  { from: 'number', to: 'string' },
  { from: 'null', to: 'string' },
  { from: 'array', to: 'object' },
];

const ENDPOINTS = [
  '/api/v1/users',
  '/api/v1/users/{id}',
  '/api/v1/auth/login',
  '/api/v1/auth/token',
  '/api/v1/payments',
  '/api/v1/payments/{id}',
  '/api/v1/orders',
  '/api/v1/orders/{id}',
  '/api/v1/products',
  '/api/v1/products/{id}',
  '/api/v1/accounts',
  '/api/v1/accounts/{id}/settings',
  '/api/v2/users/profile',
  '/api/v2/billing/invoices',
  '/api/internal/admin/users',
  '/api/internal/metrics',
];

// Deterministic random based on seed
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateTimestamp(rand: () => number, daysAgo: number): string {
  const now = new Date();
  const msAgo = daysAgo * 24 * 60 * 60 * 1000;
  const randomOffset = rand() * msAgo;
  return new Date(now.getTime() - randomOffset).toISOString();
}

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function determineRiskLevel(
  changeType: SchemaChange['changeType'],
  fieldName: string,
  rand: () => number
): RiskLevel {
  // Sensitive fields are always high/critical risk
  if (FIELD_POOLS.sensitive.includes(fieldName)) {
    return rand() > 0.5 ? 'critical' : 'high';
  }

  // PII fields are medium/high risk
  if (FIELD_POOLS.pii.includes(fieldName)) {
    return rand() > 0.6 ? 'high' : 'medium';
  }

  // Field removal is generally higher risk
  if (changeType === 'field_removed') {
    return rand() > 0.7 ? 'high' : 'medium';
  }

  // Type changes can break clients
  if (changeType === 'type_changed') {
    return rand() > 0.5 ? 'medium' : 'low';
  }

  // Field additions are usually low risk
  return rand() > 0.8 ? 'medium' : 'low';
}

function generateSchemaChange(
  id: number,
  rand: () => number,
  changeType: SchemaChange['changeType']
): SchemaChange {
  const endpoint = pickRandom(ENDPOINTS, rand);
  const endpointId = `ep_${endpoint.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

  let field: string;
  let oldValue: string | undefined;
  let newValue: string | undefined;

  // Select field based on change type and randomness
  const fieldPool =
    rand() > 0.7
      ? FIELD_POOLS.sensitive
      : rand() > 0.4
        ? FIELD_POOLS.pii
        : FIELD_POOLS.normal;

  field = pickRandom(fieldPool, rand);

  switch (changeType) {
    case 'field_added':
      newValue = pickRandom(
        ['string', 'integer', 'boolean', 'object', 'array'],
        rand
      );
      break;
    case 'field_removed':
      oldValue = pickRandom(
        ['string', 'integer', 'boolean', 'object', 'array'],
        rand
      );
      break;
    case 'type_changed':
      const typeChange = pickRandom(TYPE_CHANGES, rand);
      oldValue = typeChange.from;
      newValue = typeChange.to;
      break;
  }

  return {
    id: `sc_${id.toString().padStart(5, '0')}`,
    endpointId,
    endpoint,
    timestamp: generateTimestamp(rand, 7), // Within last 7 days
    changeType,
    field,
    oldValue,
    newValue,
    riskLevel: determineRiskLevel(changeType, field, rand),
  };
}

export interface SchemasDataResult {
  changes: SchemaChange[];
}

/**
 * Generate schema change data for the given scenario.
 */
export function generateSchemasData(scenario: DemoScenario): SchemasDataResult {
  // Profile loaded for potential future use
  void getScenarioProfile(scenario);
  const rand = seededRandom(
    scenario === 'high-threat' ? 42 : scenario === 'normal' ? 123 : 789
  );

  // Determine number of changes based on scenario
  let changeCount: number;
  switch (scenario) {
    case 'high-threat':
      // More changes during attacks (schema probing, breaking changes)
      changeCount = Math.floor(BASELINE.endpoints * 0.15);
      break;
    case 'normal':
      // Normal development pace
      changeCount = Math.floor(BASELINE.endpoints * 0.08);
      break;
    case 'quiet':
      // Few changes during quiet periods
      changeCount = Math.floor(BASELINE.endpoints * 0.02);
      break;
  }

  // Distribute change types based on scenario
  const changeTypeDistribution: SchemaChange['changeType'][] = [];
  const types: SchemaChange['changeType'][] = [
    'field_added',
    'field_removed',
    'type_changed',
  ];

  for (let i = 0; i < changeCount; i++) {
    if (scenario === 'high-threat') {
      // High-threat: more removals and type changes (breaking)
      changeTypeDistribution.push(
        rand() > 0.5 ? 'field_removed' : rand() > 0.3 ? 'type_changed' : 'field_added'
      );
    } else if (scenario === 'quiet') {
      // Quiet: mostly additions (careful development)
      changeTypeDistribution.push(
        rand() > 0.8 ? 'field_removed' : rand() > 0.3 ? 'field_added' : 'type_changed'
      );
    } else {
      // Normal: balanced distribution
      changeTypeDistribution.push(pickRandom(types, rand));
    }
  }

  // Generate changes
  const changes: SchemaChange[] = changeTypeDistribution.map((changeType, i) =>
    generateSchemaChange(i + 1, rand, changeType)
  );

  // Sort by timestamp (most recent first)
  changes.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    changes,
  };
}
