/**
 * Dashboard Data Generator
 *
 * Generates BeamDashboard data based on scenario profile.
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type {
  BeamDashboard,
  TrafficDataPoint,
  ProtectionAlert,
  AttackTypeData,
  ThreatEvent,
  EndpointThreatCount,
} from '../../../types/beam';
import { getScenarioProfile, BASELINE } from '../scenarios';

// Helper to generate UUID-like IDs
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to generate timestamp within last N hours
function generateTimestamp(hoursAgo: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(Math.floor(Math.random() * 60));
  return date.toISOString();
}

// Helper to add some variance to values
function addVariance(value: number, variancePercent: number = 0.15): number {
  const variance = value * variancePercent;
  return Math.round(value + (Math.random() - 0.5) * 2 * variance);
}

// Generate 24-hour traffic timeline
function generateTrafficTimeline(scenario: DemoScenario): TrafficDataPoint[] {
  const profile = getScenarioProfile(scenario);
  const timeline: TrafficDataPoint[] = [];

  // Traffic pattern: lower at night, peaks during business hours
  const hourlyPattern = [
    0.3, 0.2, 0.15, 0.1, 0.1, 0.2, // 00:00-05:00
    0.4, 0.6, 0.85, 1.0, 0.95, 0.9, // 06:00-11:00
    0.85, 0.9, 1.0, 0.95, 0.85, 0.7, // 12:00-17:00
    0.5, 0.45, 0.4, 0.35, 0.35, 0.3, // 18:00-23:00
  ];

  const baseRequests = BASELINE.requestsPerHour * profile.traffic.requestsMultiplier;
  const baseBlocked = BASELINE.blockedPerHour * profile.traffic.blockedMultiplier;

  for (let i = 23; i >= 0; i--) {
    const hour = (24 + new Date().getHours() - i) % 24;
    const multiplier = hourlyPattern[hour];

    const date = new Date();
    date.setHours(date.getHours() - i);
    date.setMinutes(0);
    date.setSeconds(0);

    timeline.push({
      timestamp: date.toISOString(),
      requests: addVariance(Math.round(baseRequests * multiplier)),
      blocked: addVariance(Math.round(baseBlocked * multiplier)),
    });
  }

  return timeline;
}

// Generate attack type breakdown
function generateAttackTypes(scenario: DemoScenario): AttackTypeData[] {
  const profile = getScenarioProfile(scenario);
  const types = profile.threats.primaryTypes;

  const total = profile.threats.count;
  const attackTypes: AttackTypeData[] = [];

  // Distribute attacks across primary types with decreasing percentages
  const percentages = [35, 25, 20, 15, 5]; // Totals 100%

  types.forEach((type, index) => {
    const percentage = percentages[index] || 5;
    attackTypes.push({
      type,
      count: Math.round((total * percentage) / 100),
      percentage,
    });
  });

  // Add "Other" if we have leftover percentage
  const usedPercentage = attackTypes.reduce((sum, t) => sum + t.percentage, 0);
  if (usedPercentage < 100) {
    attackTypes.push({
      type: 'Other',
      count: Math.round((total * (100 - usedPercentage)) / 100),
      percentage: 100 - usedPercentage,
    });
  }

  return attackTypes;
}

// Generate protection alerts based on scenario
function generateAlerts(scenario: DemoScenario): ProtectionAlert[] {
  const profile = getScenarioProfile(scenario);
  const alerts: ProtectionAlert[] = [];

  const alertTemplates: Array<{
    type: ProtectionAlert['type'];
    title: string;
    description: string;
  }> = [
    {
      type: 'rule_triggered',
      title: 'SQL Injection Blocked',
      description: 'Multiple SQL injection attempts detected and blocked from suspicious IP range',
    },
    {
      type: 'rule_triggered',
      title: 'Credential Stuffing Attack',
      description: 'Automated credential stuffing attack targeting /api/auth/login endpoint',
    },
    {
      type: 'endpoint_discovered',
      title: 'New Endpoint Detected',
      description: 'Discovered new endpoint: POST /api/v2/users/bulk-import',
    },
    {
      type: 'schema_change',
      title: 'Schema Change Detected',
      description: 'Response schema changed for GET /api/products: new field "internal_id" added',
    },
    {
      type: 'rule_triggered',
      title: 'Rate Limit Exceeded',
      description: 'IP 192.168.45.123 exceeded rate limit of 1000 req/min on /api/search',
    },
    {
      type: 'deployment_complete',
      title: 'Rule Deployment Complete',
      description: 'XSS Protection rule deployed to all 24 sensors successfully',
    },
    {
      type: 'rule_triggered',
      title: 'Bot Traffic Detected',
      description: 'Suspicious bot activity from AS12345 targeting product catalog',
    },
    {
      type: 'endpoint_discovered',
      title: 'Shadow API Endpoint',
      description: 'Unprotected endpoint discovered: DELETE /api/admin/cache (high risk)',
    },
    {
      type: 'rule_triggered',
      title: 'DDoS Attack Mitigated',
      description: 'Layer 7 DDoS attack blocked: 50,000 req/s from botnet infrastructure',
    },
    {
      type: 'schema_change',
      title: 'Breaking Schema Change',
      description: 'Required field "user_id" removed from POST /api/orders response',
    },
  ];

  // Generate critical alerts
  for (let i = 0; i < profile.alerts.criticalCount; i++) {
    const template = alertTemplates[i % alertTemplates.length];
    alerts.push({
      id: generateId(),
      type: template.type,
      title: template.title,
      description: template.description,
      timestamp: generateTimestamp(Math.floor(Math.random() * 4)), // Within last 4 hours
      severity: 'critical',
    });
  }

  // Generate high alerts
  for (let i = 0; i < profile.alerts.highCount; i++) {
    const template = alertTemplates[(i + 3) % alertTemplates.length];
    alerts.push({
      id: generateId(),
      type: template.type,
      title: template.title,
      description: template.description,
      timestamp: generateTimestamp(4 + Math.floor(Math.random() * 8)), // 4-12 hours ago
      severity: 'high',
    });
  }

  // Generate medium alerts
  for (let i = 0; i < profile.alerts.mediumCount; i++) {
    const template = alertTemplates[(i + 5) % alertTemplates.length];
    alerts.push({
      id: generateId(),
      type: template.type,
      title: template.title,
      description: template.description,
      timestamp: generateTimestamp(12 + Math.floor(Math.random() * 12)), // 12-24 hours ago
      severity: 'medium',
    });
  }

  // Sort by timestamp (newest first)
  alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return alerts;
}

// Generate recent threats for dashboard
function generateRecentThreats(scenario: DemoScenario): ThreatEvent[] {
  const profile = getScenarioProfile(scenario);
  const threats: ThreatEvent[] = [];
  const count = Math.min(profile.threats.count, 10); // Show max 10 recent

  const ips = [
    '185.220.101.42',
    '45.155.205.233',
    '162.142.125.217',
    '89.248.165.90',
    '104.131.3.201',
    '198.235.24.157',
    '91.240.118.172',
    '167.99.188.11',
    '185.156.73.91',
    '209.141.55.232',
  ];

  const actions = ['blocked', 'challenged', 'throttled'];

  for (let i = 0; i < count; i++) {
    const type = profile.threats.primaryTypes[i % profile.threats.primaryTypes.length];
    threats.push({
      id: generateId(),
      timestamp: generateTimestamp(Math.floor(Math.random() * 24)),
      type,
      sourceIp: ips[i % ips.length],
      action: actions[Math.floor(Math.random() * actions.length)],
      rule: `rule_${type.toLowerCase().replace(/\s+/g, '_')}`,
    });
  }

  // Sort by timestamp (newest first)
  threats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return threats;
}

// Generate top endpoints by threat count
function generateTopEndpoints(scenario: DemoScenario): EndpointThreatCount[] {
  const profile = getScenarioProfile(scenario);
  const baseCount = Math.round(profile.threats.count / 10);

  return [
    { endpoint: 'POST /api/auth/login', threatCount: addVariance(baseCount * 3) },
    { endpoint: 'GET /api/users/{id}', threatCount: addVariance(baseCount * 2.5) },
    { endpoint: 'POST /api/orders', threatCount: addVariance(baseCount * 2) },
    { endpoint: 'GET /api/products/search', threatCount: addVariance(baseCount * 1.8) },
    { endpoint: 'PUT /api/users/{id}/profile', threatCount: addVariance(baseCount * 1.5) },
    { endpoint: 'DELETE /api/cart/{id}', threatCount: addVariance(baseCount * 1.2) },
    { endpoint: 'POST /api/payments/process', threatCount: addVariance(baseCount) },
    { endpoint: 'GET /api/admin/users', threatCount: addVariance(baseCount * 0.8) },
  ];
}

// Calculate summary metrics
function calculateSummaryMetrics(
  scenario: DemoScenario,
  trafficTimeline: TrafficDataPoint[]
) {
  const profile = getScenarioProfile(scenario);

  // Sum up timeline for totals
  const totalRequests = trafficTimeline.reduce((sum, point) => sum + point.requests, 0);
  const totalBlocked = trafficTimeline.reduce((sum, point) => sum + point.blocked, 0);

  // Calculate trends based on scenario
  const trendModifier = scenario === 'high-threat' ? 1.5 : scenario === 'quiet' ? -0.3 : 0.1;

  return {
    requests: {
      value: totalRequests,
      trend: Math.round(trendModifier * 15 + (Math.random() - 0.5) * 10),
      period: '24h',
    },
    blocked: {
      value: totalBlocked,
      trend: Math.round(
        (scenario === 'high-threat' ? 85 : scenario === 'quiet' ? -20 : 5) +
          (Math.random() - 0.5) * 10
      ),
      period: '24h',
    },
    threats: {
      value: profile.threats.count,
      trend: Math.round(
        (scenario === 'high-threat' ? 120 : scenario === 'quiet' ? -40 : 3) +
          (Math.random() - 0.5) * 15
      ),
      period: '24h',
    },
    coverage: {
      value: Math.round((BASELINE.protectedEndpoints / BASELINE.endpoints) * 100),
      trend: Math.round(2 + Math.random() * 3),
      period: '7d',
    },
  };
}

// Main export
export interface DashboardData {
  dashboard: BeamDashboard;
  trafficTimeline: TrafficDataPoint[];
  alerts: ProtectionAlert[];
}

export function generateDashboardData(scenario: DemoScenario): DashboardData {
  const profile = getScenarioProfile(scenario);
  const trafficTimeline = generateTrafficTimeline(scenario);
  const attackTypes = generateAttackTypes(scenario);
  const alerts = generateAlerts(scenario);
  const recentThreats = generateRecentThreats(scenario);
  const topEndpoints = generateTopEndpoints(scenario);
  const summary = calculateSummaryMetrics(scenario, trafficTimeline);

  const dashboard: BeamDashboard = {
    status: profile.status.dashboardStatus,
    siteCount: 3,
    endpointCount: BASELINE.endpoints,
    activeRuleCount: BASELINE.rules,
    lastUpdated: new Date().toISOString(),
    summary,
    trafficTimeline,
    attackTypes,
    recentThreats,
    topEndpoints,
    alerts,
  };

  return {
    dashboard,
    trafficTimeline,
    alerts,
  };
}
