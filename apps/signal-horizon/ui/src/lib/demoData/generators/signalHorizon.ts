/**
 * Signal Horizon Data Generator
 *
 * Generates demo data for the Signal Horizon section including:
 * - Campaigns (cross-tenant threat correlation)
 * - Threats (individual threat indicators)
 * - Alerts (real-time notifications)
 * - Sensor stats (connection statistics)
 * - Attack map data (geo visualization)
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type { Campaign, Threat, ThreatAlert } from '../../../stores/horizonStore';
import { getScenarioProfile } from '../scenarios';

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateTimestamp(hoursAgo: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(Math.floor(Math.random() * 60));
  date.setSeconds(Math.floor(Math.random() * 60));
  return date.toISOString();
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// =============================================================================
// Campaign Data
// =============================================================================

const CAMPAIGN_NAMES = [
  'Operation Dark Phoenix',
  'Credential Harvester Wave',
  'Botnet Alpha Strike',
  'Shadow DDoS Collective',
  'Phantom API Crawler',
  'Storm Front Attack',
  'Hydra Credential Spray',
  'Silent Scanner Network',
  'Zero-Day Exploiter Ring',
  'Ghost Login Attempt',
  'Nightfall Injection Campaign',
  'Automated Enumeration Wave',
];

const CAMPAIGN_DESCRIPTIONS: Record<string, string> = {
  'Operation Dark Phoenix':
    'Coordinated credential stuffing campaign targeting authentication endpoints across multiple tenants',
  'Credential Harvester Wave':
    'Large-scale automated login attempts using leaked credential databases',
  'Botnet Alpha Strike':
    'Distributed bot network performing reconnaissance and vulnerability scanning',
  'Shadow DDoS Collective':
    'Volumetric attack pattern from geographically distributed infrastructure',
  'Phantom API Crawler':
    'Automated API enumeration attempting to discover undocumented endpoints',
  'Storm Front Attack':
    'Multi-vector attack combining injection attempts with rate limit abuse',
  'Hydra Credential Spray':
    'Password spraying campaign using common credentials across user base',
  'Silent Scanner Network':
    'Low-and-slow reconnaissance scan evading rate limits',
  'Zero-Day Exploiter Ring':
    'Targeted exploitation attempts against specific vulnerability patterns',
  'Ghost Login Attempt':
    'Automated authentication probes from rotating residential proxies',
  'Nightfall Injection Campaign':
    'SQL and NoSQL injection attempts across form inputs and API parameters',
  'Automated Enumeration Wave':
    'Systematic user and resource enumeration across API surface',
};

function generateCampaigns(scenario: DemoScenario): Campaign[] {
  const profile = getScenarioProfile(scenario);
  const campaigns: Campaign[] = [];

  // Determine count based on scenario
  let minCount: number, maxCount: number;
  switch (scenario) {
    case 'high-threat':
      minCount = 3;
      maxCount = 5;
      break;
    case 'normal':
      minCount = 1;
      maxCount = 2;
      break;
    case 'quiet':
      minCount = 0;
      maxCount = 0;
      break;
  }

  const count = randomBetween(minCount, maxCount);
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Pick unique campaign name
    let name: string;
    do {
      name = pickRandom(CAMPAIGN_NAMES);
    } while (usedNames.has(name) && usedNames.size < CAMPAIGN_NAMES.length);
    usedNames.add(name);

    // Determine status based on scenario
    let status: Campaign['status'];
    let severity: Campaign['severity'];

    if (scenario === 'high-threat') {
      // High-threat: mostly ACTIVE with CRITICAL/HIGH severity
      status = pickRandom(['ACTIVE', 'ACTIVE', 'ACTIVE', 'MONITORING'] as const);
      severity = pickRandom(['CRITICAL', 'CRITICAL', 'HIGH', 'HIGH', 'MEDIUM'] as const);
    } else {
      // Normal: mostly MONITORING with lower severity
      status = pickRandom(['MONITORING', 'MONITORING', 'RESOLVED', 'ACTIVE'] as const);
      severity = pickRandom(['MEDIUM', 'LOW', 'HIGH'] as const);
    }

    // Cross-tenant more likely in high-threat scenarios
    const isCrossTenant = scenario === 'high-threat'
      ? Math.random() > 0.3
      : Math.random() > 0.7;

    const tenantsAffected = isCrossTenant
      ? randomBetween(2, scenario === 'high-threat' ? 8 : 4)
      : 1;

    const hoursAgo = randomBetween(1, 72);

    campaigns.push({
      id: generateId(),
      name,
      description: CAMPAIGN_DESCRIPTIONS[name],
      status,
      severity,
      isCrossTenant,
      tenantsAffected,
      confidence: randomFloat(0.65, 0.95),
      firstSeenAt: generateTimestamp(hoursAgo + randomBetween(12, 48)),
      lastActivityAt: generateTimestamp(hoursAgo),
    });
  }

  // Sort by lastActivityAt (newest first)
  campaigns.sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  );

  // Update activeCampaigns in profile if needed (reference only)
  void profile.status.activeCampaigns;

  return campaigns;
}

// =============================================================================
// Threat Data
// =============================================================================

const THREAT_TYPES = [
  'credential-stuffing',
  'scanner',
  'bot',
  'sql-injection',
  'xss',
  'brute-force',
  'path-traversal',
  'api-abuse',
  'rate-abuse',
  'data-exfil',
];

// Known malicious IP ranges for demo realism
const MALICIOUS_IP_PREFIXES = [
  '185.220.101', // Tor exit nodes
  '45.155.205',  // Eastern Europe hosting
  '162.142.125', // Censys scanner
  '89.248.165',  // NL hosting
  '91.240.118',  // RU hosting
  '185.156.73',  // BG hosting
  '23.129.64',   // Tor exit
  '77.247.181',  // Tor exit
  '195.206.105', // NL hosting
  '45.83.65',    // DE hosting
  '93.174.95',   // NL hosting
  '209.141.55',  // US VPN
];

const FINGERPRINT_PREFIXES = [
  'fp_bot_',
  'fp_scanner_',
  'fp_headless_',
  'fp_automation_',
  'fp_suspicious_',
];

function generateIndicator(_threatType: string): string {
  // Mix of IPs and fingerprints (threatType available for future type-specific indicator patterns)
  if (Math.random() > 0.3) {
    const prefix = pickRandom(MALICIOUS_IP_PREFIXES);
    return `${prefix}.${randomBetween(1, 254)}`;
  }
  const fpPrefix = pickRandom(FINGERPRINT_PREFIXES);
  return `${fpPrefix}${Math.random().toString(36).substring(2, 10)}`;
}

function generateThreats(scenario: DemoScenario): Threat[] {
  const threats: Threat[] = [];

  // Determine count and risk range based on scenario
  let minCount: number, maxCount: number;
  let minRisk: number, maxRisk: number;

  switch (scenario) {
    case 'high-threat':
      minCount = 15;
      maxCount = 25;
      minRisk = 60;
      maxRisk = 95;
      break;
    case 'normal':
      minCount = 5;
      maxCount = 10;
      minRisk = 30;
      maxRisk = 70;
      break;
    case 'quiet':
      minCount = 0;
      maxCount = 2;
      minRisk = 10;
      maxRisk = 40;
      break;
  }

  const count = randomBetween(minCount, maxCount);

  for (let i = 0; i < count; i++) {
    const threatType = pickRandom(THREAT_TYPES);
    const riskScore = randomBetween(minRisk, maxRisk);

    // Fleet threats more common in high-threat scenarios
    const isFleetThreat = scenario === 'high-threat'
      ? Math.random() > 0.4
      : scenario === 'normal'
        ? Math.random() > 0.7
        : false;

    const tenantsAffected = isFleetThreat
      ? randomBetween(2, scenario === 'high-threat' ? 12 : 5)
      : 1;

    const fleetRiskScore = isFleetThreat
      ? randomBetween(Math.max(riskScore - 15, minRisk), Math.min(riskScore + 15, 100))
      : undefined;

    const hoursAgo = randomBetween(0, 48);

    threats.push({
      id: generateId(),
      threatType,
      indicator: generateIndicator(threatType),
      riskScore,
      fleetRiskScore,
      hitCount: randomBetween(
        scenario === 'high-threat' ? 200 : 50,
        scenario === 'high-threat' ? 5000 : 1500
      ),
      tenantsAffected,
      isFleetThreat,
      firstSeenAt: generateTimestamp(hoursAgo + randomBetween(6, 72)),
      lastSeenAt: generateTimestamp(hoursAgo),
    });
  }

  // Sort by riskScore (highest first)
  threats.sort((a, b) => b.riskScore - a.riskScore);

  return threats;
}

// =============================================================================
// Alert Data
// =============================================================================

const ALERT_TEMPLATES = {
  campaign: [
    {
      title: 'New Campaign Detected',
      description: 'Cross-tenant attack pattern identified with high confidence',
    },
    {
      title: 'Campaign Escalation',
      description: 'Existing campaign intensity has increased significantly',
    },
    {
      title: 'Campaign Targeting Expanded',
      description: 'Attack campaign now affecting additional tenants',
    },
  ],
  threat: [
    {
      title: 'High-Risk Indicator Detected',
      description: 'New threat indicator with risk score above threshold',
    },
    {
      title: 'Fleet-Wide Threat',
      description: 'Threat indicator observed across multiple tenant environments',
    },
    {
      title: 'Anomalous Activity Spike',
      description: 'Sudden increase in suspicious requests from identified source',
    },
    {
      title: 'Credential Attack Detected',
      description: 'Large-scale credential stuffing attempt in progress',
    },
  ],
  blocklist: [
    {
      title: 'IP Added to Blocklist',
      description: 'Malicious IP automatically blocked based on threat scoring',
    },
    {
      title: 'Fingerprint Blocked',
      description: 'Suspicious browser fingerprint added to blocklist',
    },
    {
      title: 'ASN Range Quarantined',
      description: 'Entire autonomous system blocked due to attack volume',
    },
  ],
};

function generateAlerts(scenario: DemoScenario): ThreatAlert[] {
  const alerts: ThreatAlert[] = [];

  // Determine count based on scenario
  let count: number;
  switch (scenario) {
    case 'high-threat':
      count = randomBetween(10, 15);
      break;
    case 'normal':
      count = randomBetween(3, 7);
      break;
    case 'quiet':
      count = randomBetween(0, 2);
      break;
  }

  for (let i = 0; i < count; i++) {
    const type = pickRandom(['campaign', 'threat', 'blocklist'] as const);
    const templates = ALERT_TEMPLATES[type];
    const template = pickRandom(templates);

    // Severity distribution based on scenario
    let severity: ThreatAlert['severity'];
    if (scenario === 'high-threat') {
      severity = pickRandom(['CRITICAL', 'CRITICAL', 'HIGH', 'HIGH', 'MEDIUM'] as const);
    } else if (scenario === 'normal') {
      severity = pickRandom(['MEDIUM', 'MEDIUM', 'LOW', 'HIGH'] as const);
    } else {
      severity = pickRandom(['LOW', 'LOW', 'MEDIUM'] as const);
    }

    const hoursAgo = randomBetween(0, 24);

    alerts.push({
      id: generateId(),
      type,
      title: template.title,
      description: template.description,
      severity,
      timestamp: Date.now() - hoursAgo * 60 * 60 * 1000,
    });
  }

  // Sort by timestamp (newest first)
  alerts.sort((a, b) => b.timestamp - a.timestamp);

  return alerts;
}

// =============================================================================
// Sensor Stats
// =============================================================================

export interface SensorStats {
  CONNECTED: number;
  DISCONNECTED: number;
  WARNING: number;
}

function generateSensorStats(scenario: DemoScenario): SensorStats {
  // Base values
  const baseConnected = randomBetween(40, 50);

  switch (scenario) {
    case 'high-threat':
      // During attacks, some sensors may show warnings
      return {
        CONNECTED: baseConnected - randomBetween(0, 3),
        DISCONNECTED: randomBetween(1, 3),
        WARNING: randomBetween(1, 4),
      };
    case 'normal':
      return {
        CONNECTED: baseConnected,
        DISCONNECTED: randomBetween(0, 2),
        WARNING: randomBetween(0, 1),
      };
    case 'quiet':
      return {
        CONNECTED: baseConnected,
        DISCONNECTED: randomBetween(0, 1),
        WARNING: 0,
      };
  }
}

// =============================================================================
// Attack Map Data (Geo Visualization)
// =============================================================================

export interface AttackPoint {
  lat: number;
  lon: number;
  region: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  hits: number;
}

export interface AttackRoute {
  from: { lat: number; lon: number; region: string };
  to: { lat: number; lon: number; region: string };
  intensity: number; // 0-1
}

// Major attack source regions with coordinates
const ATTACK_ORIGINS = [
  { lat: 55.7558, lon: 37.6173, region: 'Moscow, RU' },
  { lat: 39.9042, lon: 116.4074, region: 'Beijing, CN' },
  { lat: 31.2304, lon: 121.4737, region: 'Shanghai, CN' },
  { lat: 52.52, lon: 13.405, region: 'Berlin, DE' },
  { lat: 52.3676, lon: 4.9041, region: 'Amsterdam, NL' },
  { lat: 50.4501, lon: 30.5234, region: 'Kyiv, UA' },
  { lat: 42.6977, lon: 23.3219, region: 'Sofia, BG' },
  { lat: 41.0082, lon: 28.9784, region: 'Istanbul, TR' },
  { lat: 22.3193, lon: 114.1694, region: 'Hong Kong, HK' },
  { lat: 1.3521, lon: 103.8198, region: 'Singapore, SG' },
  { lat: -33.8688, lon: 151.2093, region: 'Sydney, AU' },
  { lat: 35.6762, lon: 139.6503, region: 'Tokyo, JP' },
  { lat: -23.5505, lon: -46.6333, region: 'Sao Paulo, BR' },
  { lat: 51.5074, lon: -0.1278, region: 'London, UK' },
  { lat: 48.8566, lon: 2.3522, region: 'Paris, FR' },
];

// Target data centers (destination points)
const TARGET_DATACENTERS = [
  { lat: 37.7749, lon: -122.4194, region: 'San Francisco, US' },
  { lat: 40.7128, lon: -74.006, region: 'New York, US' },
  { lat: 47.6062, lon: -122.3321, region: 'Seattle, US' },
  { lat: 33.749, lon: -84.388, region: 'Atlanta, US' },
  { lat: 39.7392, lon: -104.9903, region: 'Denver, US' },
  { lat: 45.5017, lon: -73.5673, region: 'Montreal, CA' },
  { lat: 49.2827, lon: -123.1207, region: 'Vancouver, CA' },
  { lat: 53.3498, lon: -6.2603, region: 'Dublin, IE' },
];

export interface AttackMapData {
  attackPoints: AttackPoint[];
  attackRoutes: AttackRoute[];
}

function generateAttackMapData(scenario: DemoScenario): AttackMapData {
  const attackPoints: AttackPoint[] = [];
  const attackRoutes: AttackRoute[] = [];

  // Determine number of attack points based on scenario
  let pointCount: number;
  switch (scenario) {
    case 'high-threat':
      pointCount = randomBetween(8, 12);
      break;
    case 'normal':
      pointCount = randomBetween(3, 6);
      break;
    case 'quiet':
      pointCount = randomBetween(0, 2);
      break;
  }

  // Select random origins
  const selectedOrigins = [...ATTACK_ORIGINS]
    .sort(() => Math.random() - 0.5)
    .slice(0, pointCount);

  // Generate attack points
  selectedOrigins.forEach((origin) => {
    let severity: AttackPoint['severity'];
    let minHits: number, maxHits: number;

    if (scenario === 'high-threat') {
      severity = pickRandom(['CRITICAL', 'HIGH', 'HIGH', 'MEDIUM'] as const);
      minHits = 500;
      maxHits = 10000;
    } else if (scenario === 'normal') {
      severity = pickRandom(['MEDIUM', 'LOW', 'HIGH'] as const);
      minHits = 100;
      maxHits = 2000;
    } else {
      severity = pickRandom(['LOW', 'LOW', 'MEDIUM'] as const);
      minHits = 10;
      maxHits = 500;
    }

    attackPoints.push({
      lat: origin.lat,
      lon: origin.lon,
      region: origin.region,
      severity,
      hits: randomBetween(minHits, maxHits),
    });
  });

  // Generate attack routes from origins to targets
  if (attackPoints.length > 0) {
    // Pick 2-4 target datacenters
    const targetCount = Math.min(randomBetween(2, 4), TARGET_DATACENTERS.length);
    const selectedTargets = [...TARGET_DATACENTERS]
      .sort(() => Math.random() - 0.5)
      .slice(0, targetCount);

    // Create routes from each origin to random targets
    attackPoints.forEach((origin) => {
      // Each origin connects to 1-2 targets
      const routeCount = randomBetween(1, Math.min(2, selectedTargets.length));
      const targets = [...selectedTargets]
        .sort(() => Math.random() - 0.5)
        .slice(0, routeCount);

      targets.forEach((target) => {
        attackRoutes.push({
          from: { lat: origin.lat, lon: origin.lon, region: origin.region },
          to: { lat: target.lat, lon: target.lon, region: target.region },
          intensity: randomFloat(
            scenario === 'high-threat' ? 0.5 : 0.2,
            scenario === 'high-threat' ? 1.0 : 0.7
          ),
        });
      });
    });
  }

  return { attackPoints, attackRoutes };
}

// =============================================================================
// Main Export
// =============================================================================

export interface SignalHorizonData {
  campaigns: Campaign[];
  threats: Threat[];
  alerts: ThreatAlert[];
  sensorStats: SensorStats;
  attackMapData: AttackMapData;
}

export function generateSignalHorizonData(scenario: DemoScenario): SignalHorizonData {
  return {
    campaigns: generateCampaigns(scenario),
    threats: generateThreats(scenario),
    alerts: generateAlerts(scenario),
    sensorStats: generateSensorStats(scenario),
    attackMapData: generateAttackMapData(scenario),
  };
}
