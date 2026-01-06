/**
 * Analytics Data Generator
 *
 * Generates analytics data: traffic hourly, method breakdown, top endpoints.
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type { TrafficDataPoint } from '../../../types/beam';
import { getScenarioProfile, BASELINE } from '../scenarios';

// Helper to add variance to values
function addVariance(value: number, variancePercent: number = 0.15): number {
  const variance = value * variancePercent;
  return Math.round(value + (Math.random() - 0.5) * 2 * variance);
}

// Traffic pattern: lower at night, peaks during business hours
const HOURLY_PATTERN = [
  0.3, 0.2, 0.15, 0.1, 0.1, 0.2, // 00:00-05:00
  0.4, 0.6, 0.85, 1.0, 0.95, 0.9, // 06:00-11:00
  0.85, 0.9, 1.0, 0.95, 0.85, 0.7, // 12:00-17:00
  0.5, 0.45, 0.4, 0.35, 0.35, 0.3, // 18:00-23:00
];

// Generate 24-hour traffic data
function generateTrafficHourly(scenario: DemoScenario): TrafficDataPoint[] {
  const profile = getScenarioProfile(scenario);
  const hourly: TrafficDataPoint[] = [];

  const baseRequests = BASELINE.requestsPerHour * profile.traffic.requestsMultiplier;
  const baseBlocked = BASELINE.blockedPerHour * profile.traffic.blockedMultiplier;

  for (let i = 23; i >= 0; i--) {
    const hour = (24 + new Date().getHours() - i) % 24;
    const multiplier = HOURLY_PATTERN[hour];

    const date = new Date();
    date.setHours(date.getHours() - i);
    date.setMinutes(0);
    date.setSeconds(0);

    hourly.push({
      timestamp: date.toISOString(),
      requests: addVariance(Math.round(baseRequests * multiplier)),
      blocked: addVariance(Math.round(baseBlocked * multiplier)),
    });
  }

  return hourly;
}

// Method breakdown interface
interface MethodBreakdown {
  method: string;
  percentage: number;
}

// Generate HTTP method breakdown
function generateMethodBreakdown(scenario: DemoScenario): MethodBreakdown[] {
  // Base distribution varies slightly by scenario
  // High-threat has more POST (attacks often target mutation endpoints)
  // Quiet has more GET (normal browsing)

  const distributions: Record<DemoScenario, Record<string, number>> = {
    'high-threat': {
      GET: 45,
      POST: 35,
      PUT: 12,
      DELETE: 5,
      PATCH: 3,
    },
    normal: {
      GET: 55,
      POST: 25,
      PUT: 12,
      DELETE: 5,
      PATCH: 3,
    },
    quiet: {
      GET: 65,
      POST: 20,
      PUT: 9,
      DELETE: 4,
      PATCH: 2,
    },
  };

  const dist = distributions[scenario];

  return Object.entries(dist).map(([method, percentage]) => ({
    method,
    percentage: addVariance(percentage, 0.1), // Small variance
  }));
}

// Top endpoint interface
interface TopEndpoint {
  endpoint: string;
  requests: number;
  blocked: number;
}

// Endpoint templates for generating realistic data
const ENDPOINT_TEMPLATES = [
  { path: 'GET /api/products', baseRequests: 45000, baseBlocked: 150 },
  { path: 'GET /api/products/{id}', baseRequests: 38000, baseBlocked: 120 },
  { path: 'POST /api/auth/login', baseRequests: 25000, baseBlocked: 2500 },
  { path: 'GET /api/users/{id}', baseRequests: 22000, baseBlocked: 800 },
  { path: 'GET /api/products/search', baseRequests: 18000, baseBlocked: 450 },
  { path: 'POST /api/orders', baseRequests: 15000, baseBlocked: 350 },
  { path: 'GET /api/cart', baseRequests: 12000, baseBlocked: 80 },
  { path: 'PUT /api/users/{id}/profile', baseRequests: 8500, baseBlocked: 320 },
  { path: 'POST /api/cart/add', baseRequests: 7200, baseBlocked: 150 },
  { path: 'GET /api/orders/{id}', baseRequests: 6800, baseBlocked: 90 },
  { path: 'POST /api/payments/process', baseRequests: 5500, baseBlocked: 450 },
  { path: 'DELETE /api/cart/{id}', baseRequests: 4200, baseBlocked: 60 },
  { path: 'GET /api/admin/users', baseRequests: 2800, baseBlocked: 380 },
  { path: 'POST /api/webhooks/stripe', baseRequests: 2500, baseBlocked: 120 },
  { path: 'POST /api/graphql', baseRequests: 2200, baseBlocked: 280 },
];

// Generate top endpoints by traffic
function generateTopEndpoints(
  scenario: DemoScenario,
  count: number = 10
): TopEndpoint[] {
  const profile = getScenarioProfile(scenario);

  return ENDPOINT_TEMPLATES.slice(0, count).map((template) => ({
    endpoint: template.path,
    requests: addVariance(
      Math.round(template.baseRequests * profile.traffic.requestsMultiplier)
    ),
    blocked: addVariance(
      Math.round(template.baseBlocked * profile.traffic.blockedMultiplier)
    ),
  }));
}

// Main export interface
export interface AnalyticsData {
  trafficHourly: TrafficDataPoint[];
  methodBreakdown: MethodBreakdown[];
  topEndpoints: TopEndpoint[];
}

export function generateAnalyticsData(scenario: DemoScenario): AnalyticsData {
  return {
    trafficHourly: generateTrafficHourly(scenario),
    methodBreakdown: generateMethodBreakdown(scenario),
    topEndpoints: generateTopEndpoints(scenario, 10),
  };
}
