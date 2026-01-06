/**
 * Endpoints Demo Data Generator
 *
 * Generates Endpoint[] for demo scenarios with realistic API paths,
 * methods, services, and risk levels.
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type {
  Endpoint,
  RiskLevel,
  EndpointSchema,
} from '../../../types/beam';
import { getScenarioProfile } from '../scenarios';

// Service definitions with their typical endpoints
const SERVICE_ENDPOINTS: Array<{
  service: string;
  endpoints: Array<{
    method: Endpoint['method'];
    path: string;
    pathTemplate: string;
    baseRisk: RiskLevel;
    sensitiveFields: string[];
    schema?: EndpointSchema;
  }>;
}> = [
  {
    service: 'user-service',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/users',
        pathTemplate: '/api/v1/users',
        baseRisk: 'medium',
        sensitiveFields: ['email', 'phone'],
        schema: {
          request: [],
          response: [
            { name: 'id', type: 'string', sensitive: false, optional: false },
            { name: 'email', type: 'string', format: 'email', sensitive: true, optional: false },
            { name: 'name', type: 'string', sensitive: false, optional: false },
          ],
        },
      },
      {
        method: 'GET',
        path: '/api/v1/users/123',
        pathTemplate: '/api/v1/users/{id}',
        baseRisk: 'medium',
        sensitiveFields: ['email', 'phone', 'ssn'],
        schema: {
          request: [],
          response: [
            { name: 'id', type: 'string', sensitive: false, optional: false },
            { name: 'email', type: 'string', format: 'email', sensitive: true, optional: false },
            { name: 'ssn', type: 'string', sensitive: true, optional: true },
          ],
        },
      },
      {
        method: 'POST',
        path: '/api/v1/users',
        pathTemplate: '/api/v1/users',
        baseRisk: 'high',
        sensitiveFields: ['password', 'email'],
        schema: {
          request: [
            { name: 'email', type: 'string', format: 'email', sensitive: true, optional: false },
            { name: 'password', type: 'string', sensitive: true, optional: false },
            { name: 'name', type: 'string', sensitive: false, optional: false },
          ],
          response: [
            { name: 'id', type: 'string', sensitive: false, optional: false },
            { name: 'email', type: 'string', format: 'email', sensitive: true, optional: false },
          ],
        },
      },
      {
        method: 'PUT',
        path: '/api/v1/users/123',
        pathTemplate: '/api/v1/users/{id}',
        baseRisk: 'high',
        sensitiveFields: ['email', 'phone'],
      },
      {
        method: 'DELETE',
        path: '/api/v1/users/123',
        pathTemplate: '/api/v1/users/{id}',
        baseRisk: 'critical',
        sensitiveFields: [],
      },
    ],
  },
  {
    service: 'order-service',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/orders',
        pathTemplate: '/api/v1/orders',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/orders/456',
        pathTemplate: '/api/v1/orders/{id}',
        baseRisk: 'low',
        sensitiveFields: ['shippingAddress'],
      },
      {
        method: 'POST',
        path: '/api/v1/orders',
        pathTemplate: '/api/v1/orders',
        baseRisk: 'medium',
        sensitiveFields: ['paymentMethod'],
        schema: {
          request: [
            { name: 'items', type: 'array', sensitive: false, optional: false },
            { name: 'shippingAddress', type: 'object', sensitive: true, optional: false },
            { name: 'paymentMethod', type: 'string', sensitive: true, optional: false },
          ],
          response: [
            { name: 'orderId', type: 'string', sensitive: false, optional: false },
            { name: 'status', type: 'string', sensitive: false, optional: false },
          ],
        },
      },
      {
        method: 'PATCH',
        path: '/api/v1/orders/456/status',
        pathTemplate: '/api/v1/orders/{id}/status',
        baseRisk: 'medium',
        sensitiveFields: [],
      },
      {
        method: 'DELETE',
        path: '/api/v1/orders/456',
        pathTemplate: '/api/v1/orders/{id}',
        baseRisk: 'high',
        sensitiveFields: [],
      },
    ],
  },
  {
    service: 'payment-service',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/payments',
        pathTemplate: '/api/v1/payments',
        baseRisk: 'critical',
        sensitiveFields: ['cardNumber', 'cvv', 'expiryDate'],
        schema: {
          request: [
            { name: 'amount', type: 'number', sensitive: false, optional: false },
            { name: 'cardNumber', type: 'string', sensitive: true, optional: false },
            { name: 'cvv', type: 'string', sensitive: true, optional: false },
            { name: 'expiryDate', type: 'string', sensitive: true, optional: false },
          ],
          response: [
            { name: 'transactionId', type: 'string', sensitive: false, optional: false },
            { name: 'status', type: 'string', sensitive: false, optional: false },
          ],
        },
      },
      {
        method: 'GET',
        path: '/api/v1/payments/789',
        pathTemplate: '/api/v1/payments/{id}',
        baseRisk: 'high',
        sensitiveFields: ['last4'],
      },
      {
        method: 'POST',
        path: '/api/v1/payments/789/refund',
        pathTemplate: '/api/v1/payments/{id}/refund',
        baseRisk: 'critical',
        sensitiveFields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/payments/methods',
        pathTemplate: '/api/v1/payments/methods',
        baseRisk: 'medium',
        sensitiveFields: ['last4'],
      },
    ],
  },
  {
    service: 'auth-service',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/auth/login',
        pathTemplate: '/api/v1/auth/login',
        baseRisk: 'critical',
        sensitiveFields: ['password', 'token'],
        schema: {
          request: [
            { name: 'email', type: 'string', format: 'email', sensitive: true, optional: false },
            { name: 'password', type: 'string', sensitive: true, optional: false },
          ],
          response: [
            { name: 'accessToken', type: 'string', sensitive: true, optional: false },
            { name: 'refreshToken', type: 'string', sensitive: true, optional: false },
          ],
        },
      },
      {
        method: 'POST',
        path: '/api/v1/auth/register',
        pathTemplate: '/api/v1/auth/register',
        baseRisk: 'critical',
        sensitiveFields: ['password', 'email'],
      },
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        pathTemplate: '/api/v1/auth/refresh',
        baseRisk: 'high',
        sensitiveFields: ['refreshToken'],
      },
      {
        method: 'POST',
        path: '/api/v1/auth/logout',
        pathTemplate: '/api/v1/auth/logout',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'POST',
        path: '/api/v1/auth/reset-password',
        pathTemplate: '/api/v1/auth/reset-password',
        baseRisk: 'critical',
        sensitiveFields: ['email', 'newPassword'],
      },
    ],
  },
  {
    service: 'product-service',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/products',
        pathTemplate: '/api/v1/products',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/products/abc123',
        pathTemplate: '/api/v1/products/{id}',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'POST',
        path: '/api/v1/products',
        pathTemplate: '/api/v1/products',
        baseRisk: 'medium',
        sensitiveFields: [],
      },
      {
        method: 'PUT',
        path: '/api/v1/products/abc123',
        pathTemplate: '/api/v1/products/{id}',
        baseRisk: 'medium',
        sensitiveFields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/products/search',
        pathTemplate: '/api/v1/products/search',
        baseRisk: 'low',
        sensitiveFields: [],
      },
    ],
  },
  {
    service: 'inventory-service',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/inventory',
        pathTemplate: '/api/v1/inventory',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/inventory/sku123',
        pathTemplate: '/api/v1/inventory/{sku}',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'PATCH',
        path: '/api/v1/inventory/sku123',
        pathTemplate: '/api/v1/inventory/{sku}',
        baseRisk: 'medium',
        sensitiveFields: [],
      },
      {
        method: 'POST',
        path: '/api/v1/inventory/reserve',
        pathTemplate: '/api/v1/inventory/reserve',
        baseRisk: 'medium',
        sensitiveFields: [],
      },
    ],
  },
  {
    service: 'notification-service',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/notifications/email',
        pathTemplate: '/api/v1/notifications/email',
        baseRisk: 'medium',
        sensitiveFields: ['email', 'body'],
      },
      {
        method: 'POST',
        path: '/api/v1/notifications/sms',
        pathTemplate: '/api/v1/notifications/sms',
        baseRisk: 'medium',
        sensitiveFields: ['phone', 'message'],
      },
      {
        method: 'GET',
        path: '/api/v1/notifications/preferences',
        pathTemplate: '/api/v1/notifications/preferences',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'PUT',
        path: '/api/v1/notifications/preferences',
        pathTemplate: '/api/v1/notifications/preferences',
        baseRisk: 'low',
        sensitiveFields: [],
      },
    ],
  },
  {
    service: 'analytics-service',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/analytics/events',
        pathTemplate: '/api/v1/analytics/events',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/analytics/dashboard',
        pathTemplate: '/api/v1/analytics/dashboard',
        baseRisk: 'medium',
        sensitiveFields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/analytics/reports',
        pathTemplate: '/api/v1/analytics/reports',
        baseRisk: 'medium',
        sensitiveFields: [],
      },
    ],
  },
  {
    service: 'search-service',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/search',
        pathTemplate: '/api/v1/search',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'POST',
        path: '/api/v1/search/advanced',
        pathTemplate: '/api/v1/search/advanced',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/search/suggestions',
        pathTemplate: '/api/v1/search/suggestions',
        baseRisk: 'low',
        sensitiveFields: [],
      },
    ],
  },
  {
    service: 'file-service',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/files/upload',
        pathTemplate: '/api/v1/files/upload',
        baseRisk: 'high',
        sensitiveFields: [],
      },
      {
        method: 'GET',
        path: '/api/v1/files/download/file123',
        pathTemplate: '/api/v1/files/download/{id}',
        baseRisk: 'medium',
        sensitiveFields: [],
      },
      {
        method: 'DELETE',
        path: '/api/v1/files/file123',
        pathTemplate: '/api/v1/files/{id}',
        baseRisk: 'high',
        sensitiveFields: [],
      },
    ],
  },
  {
    service: 'admin-service',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/admin/users',
        pathTemplate: '/api/v1/admin/users',
        baseRisk: 'critical',
        sensitiveFields: ['email', 'role', 'permissions'],
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/users/123/role',
        pathTemplate: '/api/v1/admin/users/{id}/role',
        baseRisk: 'critical',
        sensitiveFields: ['role', 'permissions'],
      },
      {
        method: 'GET',
        path: '/api/v1/admin/audit-logs',
        pathTemplate: '/api/v1/admin/audit-logs',
        baseRisk: 'high',
        sensitiveFields: [],
      },
      {
        method: 'POST',
        path: '/api/v1/admin/config',
        pathTemplate: '/api/v1/admin/config',
        baseRisk: 'critical',
        sensitiveFields: [],
      },
    ],
  },
  {
    service: 'webhook-service',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/webhooks',
        pathTemplate: '/api/v1/webhooks',
        baseRisk: 'medium',
        sensitiveFields: ['secret'],
      },
      {
        method: 'GET',
        path: '/api/v1/webhooks',
        pathTemplate: '/api/v1/webhooks',
        baseRisk: 'low',
        sensitiveFields: [],
      },
      {
        method: 'DELETE',
        path: '/api/v1/webhooks/wh123',
        pathTemplate: '/api/v1/webhooks/{id}',
        baseRisk: 'medium',
        sensitiveFields: [],
      },
    ],
  },
];

// Determine protection status based on risk and scenario
function getProtectionStatus(
  baseRisk: RiskLevel,
  scenario: DemoScenario
): Endpoint['protectionStatus'] {
  // In high-threat, most endpoints should be protected
  if (scenario === 'high-threat') {
    return baseRisk === 'critical' || baseRisk === 'high' ? 'protected' : Math.random() > 0.2 ? 'protected' : 'partial';
  }

  // In normal, good coverage but some partial
  if (scenario === 'normal') {
    if (baseRisk === 'critical') return 'protected';
    if (baseRisk === 'high') return Math.random() > 0.1 ? 'protected' : 'partial';
    return Math.random() > 0.15 ? 'protected' : 'partial';
  }

  // In quiet, similar to normal
  if (baseRisk === 'critical' || baseRisk === 'high') return 'protected';
  return Math.random() > 0.1 ? 'protected' : 'partial';
}

// Generate active rules based on risk level
function getActiveRules(baseRisk: RiskLevel, scenario: DemoScenario): string[] {
  const rules: string[] = [];

  // Critical endpoints get more rules
  if (baseRisk === 'critical') {
    rules.push('rule-1', 'rule-4', 'rule-8', 'rule-11', 'rule-13');
  } else if (baseRisk === 'high') {
    rules.push('rule-1', 'rule-2', 'rule-8');
  } else if (baseRisk === 'medium') {
    rules.push('rule-3', 'rule-5');
  } else {
    rules.push('rule-5');
  }

  // High-threat scenario adds more rules
  if (scenario === 'high-threat') {
    rules.push('rule-12');
  }

  return [...new Set(rules)];
}

// Calculate request count based on scenario
function calculateRequestCount(
  baseCount: number,
  method: Endpoint['method'],
  profile: ReturnType<typeof getScenarioProfile>
): number {
  let count = Math.round(baseCount * profile.traffic.requestsMultiplier);

  // GET requests are typically more frequent
  const methodMultipliers: Record<Endpoint['method'], number> = {
    GET: 3.0,
    POST: 1.0,
    PUT: 0.5,
    PATCH: 0.3,
    DELETE: 0.2,
  };

  count = Math.round(count * methodMultipliers[method]);

  // Add some randomness
  count = Math.round(count * (0.8 + Math.random() * 0.4));

  return Math.max(100, count);
}

// Adjust risk level based on scenario
function adjustRiskLevel(baseRisk: RiskLevel, scenario: DemoScenario): RiskLevel {
  if (scenario === 'high-threat') {
    // Elevate risk levels during attacks
    const riskElevation: Record<RiskLevel, RiskLevel> = {
      low: Math.random() > 0.7 ? 'medium' : 'low',
      medium: Math.random() > 0.5 ? 'high' : 'medium',
      high: Math.random() > 0.3 ? 'critical' : 'high',
      critical: 'critical',
    };
    return riskElevation[baseRisk];
  }

  if (scenario === 'quiet') {
    // Lower risk levels during quiet periods
    const riskReduction: Record<RiskLevel, RiskLevel> = {
      low: 'low',
      medium: Math.random() > 0.7 ? 'low' : 'medium',
      high: Math.random() > 0.5 ? 'medium' : 'high',
      critical: 'critical', // Critical stays critical
    };
    return riskReduction[baseRisk];
  }

  return baseRisk;
}

// Main generator function
export function generateEndpointsData(scenario: DemoScenario): {
  endpoints: Endpoint[];
} {
  const profile = getScenarioProfile(scenario);
  const endpoints: Endpoint[] = [];
  let idCounter = 1;

  // Generate timestamps
  const now = new Date();

  for (const serviceGroup of SERVICE_ENDPOINTS) {
    for (const endpointDef of serviceGroup.endpoints) {
      // Calculate times
      const firstSeenDays = 5 + Math.floor(Math.random() * 25);
      const firstSeen = new Date(now.getTime() - firstSeenDays * 24 * 60 * 60 * 1000);
      const lastSeenHours = scenario === 'quiet' ? 2 + Math.random() * 22 : Math.random() * 2;
      const lastSeen = new Date(now.getTime() - lastSeenHours * 60 * 60 * 1000);

      const endpoint: Endpoint = {
        id: `endpoint-${idCounter++}`,
        method: endpointDef.method,
        path: endpointDef.path,
        pathTemplate: endpointDef.pathTemplate,
        service: serviceGroup.service,
        riskLevel: adjustRiskLevel(endpointDef.baseRisk, scenario),
        sensitiveFields: endpointDef.sensitiveFields,
        protectionStatus: getProtectionStatus(endpointDef.baseRisk, scenario),
        activeRules: getActiveRules(endpointDef.baseRisk, scenario),
        requestCount24h: calculateRequestCount(5000, endpointDef.method, profile),
        lastSeen: lastSeen.toISOString(),
        firstSeen: firstSeen.toISOString(),
        detectedSchema: endpointDef.schema,
      };

      endpoints.push(endpoint);
    }
  }

  return { endpoints };
}

export default generateEndpointsData;
