/**
 * Threats Data Generator
 *
 * Generates BlockedRequest[] and ThreatEvent[] based on scenario profile.
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type { BlockedRequest, ThreatEvent } from '../../../types/beam';
import { getScenarioProfile } from '../scenarios';

// Helper to generate UUID-like IDs
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to generate timestamp within last N hours
function generateTimestamp(hoursAgo: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(Math.floor(Math.random() * 60));
  date.setSeconds(Math.floor(Math.random() * 60));
  return date.toISOString();
}

// Realistic IP addresses for demo
const MALICIOUS_IPS = [
  '185.220.101.42', // Known Tor exit
  '45.155.205.233', // Eastern Europe hosting
  '162.142.125.217', // Censys scanner
  '89.248.165.90', // NL hosting
  '104.131.3.201', // Digital Ocean
  '198.235.24.157', // US hosting
  '91.240.118.172', // RU hosting
  '167.99.188.11', // Digital Ocean
  '185.156.73.91', // BG hosting
  '209.141.55.232', // US VPN
  '23.129.64.157', // Tor exit
  '77.247.181.165', // Tor exit
  '195.206.105.217', // NL hosting
  '45.83.65.12', // DE hosting
  '93.174.95.106', // NL hosting
];

// Reserved for future use: legitimate IPs for contrast in mixed-traffic scenarios
export const LEGITIMATE_IPS = [
  '192.168.1.105',
  '10.0.0.42',
  '172.16.0.201',
  '192.168.50.33',
  '10.10.10.15',
];

// Common API endpoints
const ENDPOINTS = [
  { path: '/api/auth/login', method: 'POST', risk: 'high' },
  { path: '/api/auth/register', method: 'POST', risk: 'high' },
  { path: '/api/auth/reset-password', method: 'POST', risk: 'high' },
  { path: '/api/users/{id}', method: 'GET', risk: 'medium' },
  { path: '/api/users/{id}', method: 'PUT', risk: 'high' },
  { path: '/api/users/{id}/profile', method: 'PUT', risk: 'medium' },
  { path: '/api/products', method: 'GET', risk: 'low' },
  { path: '/api/products/search', method: 'GET', risk: 'medium' },
  { path: '/api/products/{id}', method: 'GET', risk: 'low' },
  { path: '/api/orders', method: 'POST', risk: 'high' },
  { path: '/api/orders/{id}', method: 'GET', risk: 'medium' },
  { path: '/api/cart', method: 'GET', risk: 'low' },
  { path: '/api/cart/add', method: 'POST', risk: 'medium' },
  { path: '/api/payments/process', method: 'POST', risk: 'critical' },
  { path: '/api/payments/refund', method: 'POST', risk: 'critical' },
  { path: '/api/admin/users', method: 'GET', risk: 'critical' },
  { path: '/api/admin/config', method: 'PUT', risk: 'critical' },
  { path: '/api/webhooks/stripe', method: 'POST', risk: 'high' },
  { path: '/api/export/users', method: 'GET', risk: 'critical' },
  { path: '/api/graphql', method: 'POST', risk: 'high' },
];

// Threat type to rule mapping
const THREAT_RULES: Record<string, { ruleId: string; ruleName: string }> = {
  'SQL Injection': { ruleId: 'rule_sqli_001', ruleName: 'SQL Injection Prevention' },
  'Credential Stuffing': {
    ruleId: 'rule_cred_001',
    ruleName: 'Credential Stuffing Protection',
  },
  DDoS: { ruleId: 'rule_ddos_001', ruleName: 'DDoS Mitigation' },
  'Bot Attack': { ruleId: 'rule_bot_001', ruleName: 'Bot Detection' },
  'Scanner Activity': { ruleId: 'rule_scan_001', ruleName: 'Scanner Detection' },
  'Rate Limit': { ruleId: 'rule_rate_001', ruleName: 'Rate Limiting' },
  'Auth Failure': { ruleId: 'rule_auth_001', ruleName: 'Auth Anomaly Detection' },
  'Bot Activity': { ruleId: 'rule_bot_002', ruleName: 'Advanced Bot Detection' },
  XSS: { ruleId: 'rule_xss_001', ruleName: 'XSS Prevention' },
  'Path Traversal': { ruleId: 'rule_path_001', ruleName: 'Path Traversal Prevention' },
  'API Abuse': { ruleId: 'rule_api_001', ruleName: 'API Abuse Prevention' },
};

// Generate risk score based on scenario and threat type
function generateRiskScore(
  scenario: DemoScenario,
  threatType: string
): number {
  // Profile used for potential future enhancements (threat severity weighting)
  void getScenarioProfile(scenario);
  const baseScore =
    scenario === 'high-threat' ? 70 : scenario === 'quiet' ? 20 : 45;

  // Higher risk for certain threat types
  const typeMultiplier: Record<string, number> = {
    'SQL Injection': 1.3,
    'Credential Stuffing': 1.25,
    DDoS: 1.4,
    'API Abuse': 1.2,
    'Bot Attack': 1.1,
  };

  const multiplier = typeMultiplier[threatType] || 1.0;
  const variance = (Math.random() - 0.5) * 20;

  return Math.min(100, Math.max(1, Math.round(baseScore * multiplier + variance)));
}

// Generate blocked requests
function generateBlockedRequests(scenario: DemoScenario): BlockedRequest[] {
  const profile = getScenarioProfile(scenario);
  const requests: BlockedRequest[] = [];

  // Number of blocked requests scales with scenario
  const count =
    scenario === 'high-threat' ? 100 : scenario === 'quiet' ? 15 : 50;

  const actions: BlockedRequest['action'][] = [
    'blocked',
    'blocked',
    'blocked', // Weight towards blocked
    'challenged',
    'throttled',
    'logged',
  ];

  for (let i = 0; i < count; i++) {
    const threatType =
      profile.threats.primaryTypes[i % profile.threats.primaryTypes.length];
    const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    const rule = THREAT_RULES[threatType] || {
      ruleId: 'rule_default',
      ruleName: 'Default Protection',
    };

    const hoursAgo = Math.random() * 24;

    requests.push({
      id: generateId(),
      timestamp: generateTimestamp(hoursAgo),
      action: actions[Math.floor(Math.random() * actions.length)],
      threatType,
      sourceIp: MALICIOUS_IPS[Math.floor(Math.random() * MALICIOUS_IPS.length)],
      endpoint: endpoint.path,
      method: endpoint.method,
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      riskScore: generateRiskScore(scenario, threatType),
    });
  }

  // Sort by timestamp (newest first)
  requests.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return requests;
}

// Generate threat events (lighter weight than full blocked requests)
function generateThreatEvents(scenario: DemoScenario): ThreatEvent[] {
  const profile = getScenarioProfile(scenario);
  const events: ThreatEvent[] = [];

  const count = profile.threats.count;
  const actions = ['blocked', 'challenged', 'throttled'];

  for (let i = 0; i < count; i++) {
    const threatType =
      profile.threats.primaryTypes[i % profile.threats.primaryTypes.length];
    const rule = THREAT_RULES[threatType];

    const hoursAgo = Math.random() * 24;

    events.push({
      id: generateId(),
      timestamp: generateTimestamp(hoursAgo),
      type: threatType,
      sourceIp: MALICIOUS_IPS[Math.floor(Math.random() * MALICIOUS_IPS.length)],
      action: actions[Math.floor(Math.random() * actions.length)],
      rule: rule?.ruleName,
    });
  }

  // Sort by timestamp (newest first)
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return events;
}

// Main export
export interface ThreatsData {
  blockedRequests: BlockedRequest[];
  threatEvents: ThreatEvent[];
}

export function generateThreatsData(scenario: DemoScenario): ThreatsData {
  return {
    blockedRequests: generateBlockedRequests(scenario),
    threatEvents: generateThreatEvents(scenario),
  };
}
