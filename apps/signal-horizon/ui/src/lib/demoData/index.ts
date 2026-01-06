/**
 * Demo Data System
 *
 * Centralized demo data generation with caching for static snapshots.
 * Each scenario generates consistent data that remains stable until
 * the scenario is changed.
 */

import type { DemoScenario } from '../../stores/demoModeStore';
import type {
  BeamDashboard,
  Endpoint,
  Service,
  SchemaChange,
  Rule,
  RuleTemplate,
  BlockedRequest,
  AttackPattern,
  ProtectionAlert,
  TrafficDataPoint,
  ResponseTimeMetrics,
  ErrorAnalysis,
  ThreatEvent,
} from '../../types/beam';

import { generateDashboardData } from './generators/dashboard';
import { generateThreatsData } from './generators/threats';
import { generateAnalyticsData } from './generators/analytics';
import { generateRulesData } from './generators/rules';
import { generateEndpointsData } from './generators/endpoints';
import { generateServicesData } from './generators/services';
import { generateSchemasData } from './generators/schemas';
import { generateResponseTimesData } from './generators/responseTimes';
import { generateErrorsData } from './generators/errors';
import { generateAttackPatternsData } from './generators/attackPatterns';
import {
  generateSignalHorizonData,
  type SignalHorizonData,
} from './generators/signalHorizon';
import { generateFleetData, type FleetData } from './generators/fleet';

// Complete demo data snapshot for a scenario
export interface DemoDataSnapshot {
  // Dashboard
  dashboard: BeamDashboard;
  trafficTimeline: TrafficDataPoint[];

  // Threats
  blockedRequests: BlockedRequest[];
  threatEvents: ThreatEvent[];
  attackPatterns: AttackPattern[];

  // Analytics
  analytics: {
    trafficHourly: TrafficDataPoint[];
    methodBreakdown: { method: string; percentage: number }[];
    topEndpoints: { endpoint: string; requests: number; blocked: number }[];
  };

  // Rules
  rules: Rule[];
  ruleTemplates: RuleTemplate[];

  // Catalog
  endpoints: Endpoint[];
  services: Service[];
  schemaChanges: SchemaChange[];

  // Performance
  responseTimes: {
    metrics: ResponseTimeMetrics;
    timeline: { time: string; p50: number; p95: number; p99: number }[];
    distribution: { range: string; count: number; percentage: number }[];
    slowestEndpoints: { endpoint: string; p50: number; p95: number; p99: number }[];
  };

  // Errors
  errors: {
    analysis: ErrorAnalysis;
    timeline: { time: string; total: number; errors4xx: number; errors5xx: number }[];
    byEndpoint: { endpoint: string; total: number; errors: number; rate: number }[];
  };

  // Alerts
  alerts: ProtectionAlert[];

  // Metadata
  generatedAt: string;
  scenario: DemoScenario;

  // Signal Horizon (main dashboard)
  signalHorizon: SignalHorizonData;

  // Fleet Operations
  fleet: FleetData;
}

// Cache for static snapshots
let cachedSnapshot: DemoDataSnapshot | null = null;
let cachedScenario: DemoScenario | null = null;

/**
 * Get demo data for a scenario.
 * Returns cached data if scenario hasn't changed (static snapshot).
 */
export function getDemoData(scenario: DemoScenario): DemoDataSnapshot {
  // Return cached data if scenario matches (static snapshot behavior)
  if (cachedSnapshot && cachedScenario === scenario) {
    return cachedSnapshot;
  }

  // Generate new snapshot for scenario
  const snapshot = generateSnapshot(scenario);

  // Cache the snapshot
  cachedSnapshot = snapshot;
  cachedScenario = scenario;

  return snapshot;
}

/**
 * Force regeneration of demo data (clears cache).
 */
export function invalidateDemoCache(): void {
  cachedSnapshot = null;
  cachedScenario = null;
}

/**
 * Check if demo data is currently cached.
 */
export function isDemoCached(): boolean {
  return cachedSnapshot !== null;
}

/**
 * Get the currently cached scenario (if any).
 */
export function getCachedScenario(): DemoScenario | null {
  return cachedScenario;
}

// Generate a complete snapshot for a scenario
function generateSnapshot(scenario: DemoScenario): DemoDataSnapshot {
  const now = new Date().toISOString();

  // Generate all data domains
  const dashboard = generateDashboardData(scenario);
  const threats = generateThreatsData(scenario);
  const analytics = generateAnalyticsData(scenario);
  const rules = generateRulesData(scenario);
  const endpoints = generateEndpointsData(scenario);
  const services = generateServicesData(scenario);
  const schemas = generateSchemasData(scenario);
  const responseTimes = generateResponseTimesData(scenario);
  const errors = generateErrorsData(scenario);
  const attackPatterns = generateAttackPatternsData(scenario);

  // Generate Signal Horizon and Fleet data
  const signalHorizon = generateSignalHorizonData(scenario);
  const fleet = generateFleetData(scenario);

  return {
    // Dashboard
    dashboard: dashboard.dashboard,
    trafficTimeline: dashboard.trafficTimeline,

    // Threats
    blockedRequests: threats.blockedRequests,
    threatEvents: threats.threatEvents,
    attackPatterns: attackPatterns.patterns,

    // Analytics
    analytics: {
      trafficHourly: analytics.trafficHourly,
      methodBreakdown: analytics.methodBreakdown,
      topEndpoints: analytics.topEndpoints,
    },

    // Rules
    rules: rules.rules,
    ruleTemplates: rules.templates,

    // Catalog
    endpoints: endpoints.endpoints,
    services: services.services,
    schemaChanges: schemas.changes,

    // Performance
    responseTimes: {
      metrics: responseTimes.metrics,
      timeline: responseTimes.timeline,
      distribution: responseTimes.distribution,
      slowestEndpoints: responseTimes.slowestEndpoints,
    },

    // Errors
    errors: {
      analysis: errors.analysis,
      timeline: errors.timeline,
      byEndpoint: errors.byEndpoint,
    },

    // Alerts
    alerts: dashboard.alerts,

    // Signal Horizon (main dashboard)
    signalHorizon,

    // Fleet Operations
    fleet,

    // Metadata
    generatedAt: now,
    scenario,
  };
}

// Re-export types and utilities
export { SCENARIO_PROFILES, getScenarioProfile, BASELINE } from './scenarios';
export type { ScenarioProfile } from './scenarios';

// Re-export Signal Horizon types
export type { SignalHorizonData, SensorStats, AttackMapData } from './generators/signalHorizon';

// Re-export Fleet types
export type {
  FleetData,
  FleetSensor,
  FleetMetrics,
  FleetOverview,
  FleetHealthData,
  ConnectivityData,
  FleetRulesData,
  OnboardingData,
  ApiKeysData,
} from './generators/fleet';
