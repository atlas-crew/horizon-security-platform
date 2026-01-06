/**
 * Services Demo Data Generator
 *
 * Generates Service[] for demo scenarios with realistic service
 * definitions, endpoint counts, and coverage percentages.
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type { Service } from '../../../types/beam';

// Service definitions with baseline metrics
const SERVICE_DEFINITIONS: Array<{
  name: string;
  baseEndpointCount: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
}> = [
  { name: 'user-service', baseEndpointCount: 5, importance: 'critical' },
  { name: 'order-service', baseEndpointCount: 5, importance: 'high' },
  { name: 'payment-service', baseEndpointCount: 4, importance: 'critical' },
  { name: 'auth-service', baseEndpointCount: 5, importance: 'critical' },
  { name: 'product-service', baseEndpointCount: 5, importance: 'high' },
  { name: 'inventory-service', baseEndpointCount: 4, importance: 'medium' },
  { name: 'notification-service', baseEndpointCount: 4, importance: 'medium' },
  { name: 'analytics-service', baseEndpointCount: 3, importance: 'low' },
  { name: 'search-service', baseEndpointCount: 3, importance: 'medium' },
  { name: 'file-service', baseEndpointCount: 3, importance: 'medium' },
  { name: 'admin-service', baseEndpointCount: 4, importance: 'critical' },
  { name: 'webhook-service', baseEndpointCount: 3, importance: 'low' },
];

// Calculate coverage based on service importance and scenario
function calculateCoverage(
  importance: 'critical' | 'high' | 'medium' | 'low',
  scenario: DemoScenario
): { protectedCount: number; coveragePercent: number; endpointCount: number } {
  const baseDef = SERVICE_DEFINITIONS.find((s) => s.importance === importance);
  const baseEndpointCount = baseDef?.baseEndpointCount ?? 4;

  // Base coverage percentages by importance
  const baseCoverage: Record<typeof importance, number> = {
    critical: 100,
    high: 95,
    medium: 90,
    low: 85,
  };

  let coverage = baseCoverage[importance];

  // Adjust based on scenario
  if (scenario === 'high-threat') {
    // During attacks, ensure maximum coverage
    coverage = Math.min(100, coverage + 5);
  } else if (scenario === 'quiet') {
    // Quiet period might have slightly lower coverage (maintenance windows)
    coverage = Math.max(80, coverage - 5);
  }

  // Add small variance
  coverage = Math.max(75, Math.min(100, coverage + (Math.random() * 6 - 3)));

  const protectedCount = Math.round((baseEndpointCount * coverage) / 100);

  return {
    endpointCount: baseEndpointCount,
    protectedCount,
    coveragePercent: Math.round(coverage),
  };
}

// Main generator function
export function generateServicesData(scenario: DemoScenario): {
  services: Service[];
} {
  const services: Service[] = SERVICE_DEFINITIONS.map((def, index) => {
    const { endpointCount, protectedCount, coveragePercent } = calculateCoverage(
      def.importance,
      scenario
    );

    return {
      id: `service-${index + 1}`,
      name: def.name,
      endpointCount,
      protectedCount,
      coveragePercent,
    };
  });

  return { services };
}

export default generateServicesData;
