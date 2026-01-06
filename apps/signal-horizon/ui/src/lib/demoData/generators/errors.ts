/**
 * Errors Demo Data Generator
 *
 * Generates error analysis data, timelines, and breakdowns.
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type { ErrorAnalysis, ErrorTypeCount } from '../../../types/beam';
import { getScenarioProfile, BASELINE } from '../scenarios';

// Deterministic random based on seed
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Common HTTP error codes
const ERROR_4XX = [
  { code: 400, name: 'Bad Request', weight: 25 },
  { code: 401, name: 'Unauthorized', weight: 20 },
  { code: 403, name: 'Forbidden', weight: 15 },
  { code: 404, name: 'Not Found', weight: 30 },
  { code: 429, name: 'Too Many Requests', weight: 10 },
];

const ERROR_5XX = [
  { code: 500, name: 'Internal Server Error', weight: 40 },
  { code: 502, name: 'Bad Gateway', weight: 20 },
  { code: 503, name: 'Service Unavailable', weight: 25 },
  { code: 504, name: 'Gateway Timeout', weight: 15 },
];

// Endpoint pool for error breakdown
const ENDPOINT_POOL = [
  '/api/v1/auth/login',
  '/api/v1/users',
  '/api/v1/users/{id}',
  '/api/v1/payments',
  '/api/v1/orders',
  '/api/v1/products/search',
  '/api/v2/checkout',
  '/api/v1/inventory',
  '/api/internal/health',
  '/api/v1/webhooks/receive',
  '/api/v1/uploads',
  '/api/v2/notifications',
  '/api/v1/reports',
  '/api/internal/sync',
  '/api/v1/analytics',
];

export interface ErrorsDataResult {
  analysis: ErrorAnalysis;
  timeline: Array<{
    time: string;
    total: number;
    errors4xx: number;
    errors5xx: number;
  }>;
  byEndpoint: Array<{
    endpoint: string;
    total: number;
    errors: number;
    rate: number;
  }>;
}

/**
 * Generate error data for the given scenario.
 */
export function generateErrorsData(scenario: DemoScenario): ErrorsDataResult {
  const profile = getScenarioProfile(scenario);
  const rand = seededRandom(
    scenario === 'high-threat' ? 888 : scenario === 'normal' ? 999 : 111
  );

  const errorMultiplier = profile.traffic.errorMultiplier;

  // Calculate total requests and errors
  const totalRequests = BASELINE.requestsPerHour * 24;
  const baseErrorRate = BASELINE.errorRate * errorMultiplier;
  const totalErrors = Math.round(totalRequests * baseErrorRate);

  // Split between 4xx and 5xx based on scenario
  const split4xx5xx = get4xx5xxSplit(scenario, rand);
  const errors4xx = Math.round(totalErrors * split4xx5xx.ratio4xx);
  const errors5xx = totalErrors - errors4xx;

  // Generate error type breakdown
  const byType = generateErrorTypeBreakdown(
    errors4xx,
    errors5xx,
    scenario,
    rand
  );

  const analysis: ErrorAnalysis = {
    total: totalErrors,
    rate: Math.round(baseErrorRate * 10000) / 100, // Convert to percentage with 2 decimals
    breakdown: {
      status4xx: errors4xx,
      status5xx: errors5xx,
    },
    byType,
  };

  // Generate 24-hour timeline
  const timeline = generateTimeline(
    totalErrors,
    split4xx5xx.ratio4xx,
    scenario,
    rand
  );

  // Generate errors by endpoint
  const byEndpoint = generateByEndpoint(totalRequests, baseErrorRate, scenario, rand);

  return {
    analysis,
    timeline,
    byEndpoint,
  };
}

function get4xx5xxSplit(
  scenario: DemoScenario,
  rand: () => number
): { ratio4xx: number } {
  switch (scenario) {
    case 'high-threat':
      // More 4xx during attacks (blocked requests, auth failures)
      return { ratio4xx: 0.7 + rand() * 0.1 };
    case 'quiet':
      // Mostly 4xx in quiet periods (user errors, not found)
      return { ratio4xx: 0.85 + rand() * 0.1 };
    default:
      // Normal: balanced
      return { ratio4xx: 0.6 + rand() * 0.15 };
  }
}

function generateErrorTypeBreakdown(
  errors4xx: number,
  errors5xx: number,
  scenario: DemoScenario,
  rand: () => number
): ErrorTypeCount[] {
  const result: ErrorTypeCount[] = [];

  // Adjust weights based on scenario
  let adjusted4xx = ERROR_4XX.map((e) => ({
    ...e,
    weight: e.weight * (0.8 + rand() * 0.4),
  }));
  let adjusted5xx = ERROR_5XX.map((e) => ({
    ...e,
    weight: e.weight * (0.8 + rand() * 0.4),
  }));

  // High-threat: more 401/403/429
  if (scenario === 'high-threat') {
    adjusted4xx = adjusted4xx.map((e) => {
      if ([401, 403, 429].includes(e.code)) {
        return { ...e, weight: e.weight * 2 };
      }
      return e;
    });
    // More 503 during attacks (rate limiting, WAF blocking)
    adjusted5xx = adjusted5xx.map((e) => {
      if (e.code === 503) {
        return { ...e, weight: e.weight * 1.5 };
      }
      return e;
    });
  }

  // Calculate 4xx distribution
  const total4xxWeight = adjusted4xx.reduce((a, b) => a + b.weight, 0);
  for (const error of adjusted4xx) {
    const count = Math.round((error.weight / total4xxWeight) * errors4xx);
    if (count > 0) {
      result.push({
        statusCode: error.code,
        count,
        percentage: Math.round((count / (errors4xx + errors5xx)) * 1000) / 10,
      });
    }
  }

  // Calculate 5xx distribution
  const total5xxWeight = adjusted5xx.reduce((a, b) => a + b.weight, 0);
  for (const error of adjusted5xx) {
    const count = Math.round((error.weight / total5xxWeight) * errors5xx);
    if (count > 0) {
      result.push({
        statusCode: error.code,
        count,
        percentage: Math.round((count / (errors4xx + errors5xx)) * 1000) / 10,
      });
    }
  }

  // Sort by count descending
  return result.sort((a, b) => b.count - a.count);
}

function generateTimeline(
  totalErrors: number,
  ratio4xx: number,
  scenario: DemoScenario,
  rand: () => number
): ErrorsDataResult['timeline'] {
  const timeline: ErrorsDataResult['timeline'] = [];
  const now = new Date();

  // Generate hourly distribution weights
  const hourlyWeights: number[] = [];
  for (let i = 0; i < 24; i++) {
    let weight = 1.0;

    // Business hours have more errors
    if (i >= 9 && i <= 17) {
      weight = 1.3 + rand() * 0.3;
    } else if (i >= 2 && i <= 6) {
      weight = 0.4 + rand() * 0.2;
    }

    // High-threat: add spikes
    if (scenario === 'high-threat' && rand() > 0.75) {
      weight *= 2.0 + rand();
    }

    hourlyWeights.push(weight);
  }

  // Normalize weights
  const totalWeight = hourlyWeights.reduce((a, b) => a + b, 0);
  const normalizedWeights = hourlyWeights.map((w) => w / totalWeight);

  // Generate timeline entries
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourStr = time.toISOString().slice(0, 13) + ':00:00Z';
    const hour = time.getHours();

    const hourErrors = Math.round(totalErrors * normalizedWeights[hour]);
    const hourErrors4xx = Math.round(
      hourErrors * (ratio4xx + (rand() * 0.1 - 0.05))
    );
    const hourErrors5xx = hourErrors - hourErrors4xx;

    timeline.push({
      time: hourStr,
      total: hourErrors,
      errors4xx: hourErrors4xx,
      errors5xx: hourErrors5xx,
    });
  }

  return timeline;
}

function generateByEndpoint(
  totalRequests: number,
  baseErrorRate: number,
  scenario: DemoScenario,
  rand: () => number
): ErrorsDataResult['byEndpoint'] {
  // Shuffle endpoints
  const shuffled = [...ENDPOINT_POOL].sort(() => rand() - 0.5);

  return shuffled.map((endpoint, i) => {
    // More popular endpoints get more requests
    const popularityFactor = Math.max(0.1, 1 - i * 0.06);
    const requests = Math.round(
      (totalRequests / ENDPOINT_POOL.length) * popularityFactor * (0.8 + rand() * 0.4)
    );

    // Error rate varies by endpoint
    let errorRate = baseErrorRate * (0.5 + rand() * 1.5);

    // Certain endpoints have higher error rates
    if (endpoint.includes('auth') || endpoint.includes('payment')) {
      errorRate *= 1.5;
    }
    if (endpoint.includes('internal')) {
      errorRate *= 0.5; // Internal endpoints are more stable
    }

    // High-threat: auth endpoints get hammered
    if (scenario === 'high-threat' && endpoint.includes('auth')) {
      errorRate *= 2;
    }

    const errors = Math.round(requests * errorRate);

    return {
      endpoint,
      total: requests,
      errors,
      rate: Math.round((errors / requests) * 10000) / 100, // Percentage
    };
  }).sort((a, b) => b.rate - a.rate); // Sort by error rate descending
}
