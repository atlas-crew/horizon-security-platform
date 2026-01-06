/**
 * Response Times Demo Data Generator
 *
 * Generates response time metrics, timelines, and distributions.
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type { ResponseTimeMetrics } from '../../../types/beam';
import { getScenarioProfile, BASELINE } from '../scenarios';

// Deterministic random based on seed
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Latency distribution buckets
const LATENCY_BUCKETS = [
  { range: '<25ms', max: 25 },
  { range: '25-50ms', max: 50 },
  { range: '50-100ms', max: 100 },
  { range: '100-250ms', max: 250 },
  { range: '250-500ms', max: 500 },
  { range: '500ms-1s', max: 1000 },
  { range: '>1s', max: Infinity },
];

// Endpoint pool for slowest endpoints
const ENDPOINT_POOL = [
  '/api/v1/reports/generate',
  '/api/v1/analytics/aggregate',
  '/api/v1/search',
  '/api/v1/exports/csv',
  '/api/v1/users/bulk',
  '/api/v2/payments/process',
  '/api/v1/inventory/sync',
  '/api/v1/images/upload',
  '/api/internal/backup',
  '/api/v1/orders/history',
  '/api/v2/billing/calculate',
  '/api/v1/products/import',
  '/api/v1/notifications/send-batch',
  '/api/internal/migrations/run',
  '/api/v1/dashboard/metrics',
];

export interface ResponseTimesDataResult {
  metrics: ResponseTimeMetrics;
  timeline: Array<{
    time: string;
    p50: number;
    p95: number;
    p99: number;
  }>;
  distribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  slowestEndpoints: Array<{
    endpoint: string;
    p50: number;
    p95: number;
    p99: number;
  }>;
}

/**
 * Generate response time data for the given scenario.
 */
export function generateResponseTimesData(
  scenario: DemoScenario
): ResponseTimesDataResult {
  const profile = getScenarioProfile(scenario);
  const rand = seededRandom(
    scenario === 'high-threat' ? 555 : scenario === 'normal' ? 666 : 777
  );

  const latencyMultiplier = profile.performance.latencyMultiplier;
  const p99Multiplier = profile.performance.p99Multiplier;

  // Calculate base metrics with scenario multipliers
  const baseP50 = BASELINE.latencyP50 * latencyMultiplier;
  const baseP95 = BASELINE.latencyP95 * latencyMultiplier;
  const baseP99 = BASELINE.latencyP99 * p99Multiplier;

  // Calculate metrics with small variance
  const metrics: ResponseTimeMetrics = {
    p50: Math.round(baseP50 * (0.95 + rand() * 0.1)),
    p75: Math.round(baseP50 * 1.8 * (0.95 + rand() * 0.1)),
    p95: Math.round(baseP95 * (0.95 + rand() * 0.1)),
    p99: Math.round(baseP99 * (0.95 + rand() * 0.1)),
    trend: {
      p50: calculateTrend(scenario, rand),
      p95: calculateTrend(scenario, rand),
      p99: calculateTrend(scenario, rand),
    },
  };

  // Generate 24-hour timeline
  const timeline = generateTimeline(scenario, metrics, rand);

  // Generate latency distribution
  const distribution = generateDistribution(scenario, metrics, rand);

  // Generate slowest endpoints
  const slowestEndpoints = generateSlowestEndpoints(scenario, metrics, rand);

  return {
    metrics,
    timeline,
    distribution,
    slowestEndpoints,
  };
}

function calculateTrend(scenario: DemoScenario, rand: () => number): number {
  switch (scenario) {
    case 'high-threat':
      // Latencies trending up during attack
      return Math.round((15 + rand() * 25) * 10) / 10;
    case 'quiet':
      // Latencies trending down during quiet periods
      return Math.round((-5 - rand() * 10) * 10) / 10;
    default:
      // Normal: slight variance around zero
      return Math.round((rand() * 10 - 5) * 10) / 10;
  }
}

function generateTimeline(
  scenario: DemoScenario,
  metrics: ResponseTimeMetrics,
  rand: () => number
): ResponseTimesDataResult['timeline'] {
  const timeline: ResponseTimesDataResult['timeline'] = [];
  const now = new Date();

  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourStr = time.toISOString().slice(0, 13) + ':00:00Z';

    // Add variance based on time of day and scenario
    let timeMultiplier = 1.0;

    // Business hours (9-17) tend to have higher latency
    const hour = time.getHours();
    if (hour >= 9 && hour <= 17) {
      timeMultiplier = 1.1 + rand() * 0.2;
    } else if (hour >= 2 && hour <= 6) {
      // Late night is quieter
      timeMultiplier = 0.7 + rand() * 0.2;
    }

    // High-threat: add spikes
    if (scenario === 'high-threat' && rand() > 0.7) {
      timeMultiplier *= 1.5 + rand() * 0.5;
    }

    timeline.push({
      time: hourStr,
      p50: Math.round(metrics.p50 * timeMultiplier * (0.9 + rand() * 0.2)),
      p95: Math.round(metrics.p95 * timeMultiplier * (0.9 + rand() * 0.2)),
      p99: Math.round(metrics.p99 * timeMultiplier * (0.85 + rand() * 0.3)),
    });
  }

  return timeline;
}

function generateDistribution(
  scenario: DemoScenario,
  _metrics: ResponseTimeMetrics,
  rand: () => number
): ResponseTimesDataResult['distribution'] {
  // Define distribution weights based on scenario
  let weights: number[];

  switch (scenario) {
    case 'high-threat':
      // Shifted toward higher latencies
      weights = [15, 20, 25, 20, 12, 5, 3];
      break;
    case 'quiet':
      // Concentrated in low latencies
      weights = [45, 30, 15, 7, 2, 0.8, 0.2];
      break;
    default:
      // Normal distribution
      weights = [30, 35, 20, 10, 3, 1.5, 0.5];
  }

  // Add some randomness to weights
  weights = weights.map((w) => w * (0.9 + rand() * 0.2));

  // Normalize to 100%
  const total = weights.reduce((a, b) => a + b, 0);
  const normalized = weights.map((w) => (w / total) * 100);

  // Assume ~1M requests for count calculation
  const totalRequests =
    BASELINE.requestsPerHour *
    24 *
    (scenario === 'high-threat' ? 3 : scenario === 'quiet' ? 0.3 : 1);

  return LATENCY_BUCKETS.map((bucket, i) => ({
    range: bucket.range,
    count: Math.round((normalized[i] / 100) * totalRequests),
    percentage: Math.round(normalized[i] * 10) / 10,
  }));
}

function generateSlowestEndpoints(
  _scenario: DemoScenario,
  metrics: ResponseTimeMetrics,
  rand: () => number
): ResponseTimesDataResult['slowestEndpoints'] {
  // Shuffle and pick 10 endpoints
  const shuffled = [...ENDPOINT_POOL].sort(() => rand() - 0.5);
  const selected = shuffled.slice(0, 10);

  return selected.map((endpoint, i) => {
    // First endpoints are slowest, with decreasing latency
    const slownessFactor = 3 - (i * 0.2);
    const variance = 0.8 + rand() * 0.4;

    return {
      endpoint,
      p50: Math.round(metrics.p50 * slownessFactor * variance),
      p95: Math.round(metrics.p95 * slownessFactor * variance),
      p99: Math.round(metrics.p99 * slownessFactor * variance),
    };
  }).sort((a, b) => b.p99 - a.p99); // Sort by p99 descending
}
