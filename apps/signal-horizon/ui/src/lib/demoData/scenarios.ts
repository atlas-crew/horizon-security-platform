import type { DemoScenario } from '../../stores/demoModeStore';

// Scenario profile configuration
export interface ScenarioProfile {
  label: string;
  description: string;
  icon: string;

  // Traffic multipliers (relative to baseline)
  traffic: {
    requestsMultiplier: number;
    blockedMultiplier: number;
    errorMultiplier: number;
  };

  // Threat characteristics
  threats: {
    count: number;
    criticalPercent: number;
    highPercent: number;
    primaryTypes: string[];
  };

  // Performance characteristics
  performance: {
    latencyMultiplier: number;
    p99Multiplier: number;
  };

  // Alert configuration
  alerts: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
  };

  // Status indicators
  status: {
    dashboardStatus: 'protected' | 'degraded' | 'critical';
    activeCampaigns: number;
  };
}

export const SCENARIO_PROFILES: Record<DemoScenario, ScenarioProfile> = {
  'high-threat': {
    label: 'High Threat Attack',
    description: 'Active attack scenario with elevated threat levels',
    icon: 'AlertTriangle',

    traffic: {
      requestsMultiplier: 5.0,
      blockedMultiplier: 8.0,
      errorMultiplier: 4.0,
    },

    threats: {
      count: 250,
      criticalPercent: 30,
      highPercent: 40,
      primaryTypes: ['SQL Injection', 'Credential Stuffing', 'DDoS', 'Bot Attack'],
    },

    performance: {
      latencyMultiplier: 2.5,
      p99Multiplier: 4.0,
    },

    alerts: {
      criticalCount: 12,
      highCount: 8,
      mediumCount: 15,
    },

    status: {
      dashboardStatus: 'critical',
      activeCampaigns: 3,
    },
  },

  normal: {
    label: 'Normal Operations',
    description: 'Steady-state production traffic',
    icon: 'Shield',

    traffic: {
      requestsMultiplier: 1.0,
      blockedMultiplier: 1.0,
      errorMultiplier: 1.0,
    },

    threats: {
      count: 50,
      criticalPercent: 5,
      highPercent: 15,
      primaryTypes: ['Scanner Activity', 'Rate Limit', 'Auth Failure', 'Bot Activity'],
    },

    performance: {
      latencyMultiplier: 1.0,
      p99Multiplier: 1.0,
    },

    alerts: {
      criticalCount: 0,
      highCount: 2,
      mediumCount: 5,
    },

    status: {
      dashboardStatus: 'protected',
      activeCampaigns: 0,
    },
  },

  quiet: {
    label: 'Quiet Period',
    description: 'Low activity, minimal threats',
    icon: 'Moon',

    traffic: {
      requestsMultiplier: 0.2,
      blockedMultiplier: 0.1,
      errorMultiplier: 0.3,
    },

    threats: {
      count: 8,
      criticalPercent: 0,
      highPercent: 5,
      primaryTypes: ['Scanner Activity'],
    },

    performance: {
      latencyMultiplier: 0.5,
      p99Multiplier: 0.6,
    },

    alerts: {
      criticalCount: 0,
      highCount: 0,
      mediumCount: 1,
    },

    status: {
      dashboardStatus: 'protected',
      activeCampaigns: 0,
    },
  },
};

// Baseline values for demo data generation
export const BASELINE = {
  // Traffic per hour
  requestsPerHour: 100000,
  blockedPerHour: 3000,

  // Performance (ms)
  latencyP50: 25,
  latencyP95: 85,
  latencyP99: 250,

  // Errors
  errorRate: 0.02,

  // Coverage
  endpoints: 150,
  protectedEndpoints: 142,
  services: 12,
  rules: 45,
};

// Helper to get profile for scenario
export function getScenarioProfile(scenario: DemoScenario): ScenarioProfile {
  return SCENARIO_PROFILES[scenario];
}

// All scenarios for iteration
export const ALL_SCENARIOS: DemoScenario[] = ['high-threat', 'normal', 'quiet'];
