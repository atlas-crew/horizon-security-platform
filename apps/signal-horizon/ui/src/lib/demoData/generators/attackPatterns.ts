/**
 * Attack Patterns Demo Data Generator
 *
 * Generates AttackPattern[] for different scenarios.
 */

import type { DemoScenario } from '../../../stores/demoModeStore';
import type { AttackPattern } from '../../../types/beam';
import { getScenarioProfile } from '../scenarios';

// Deterministic random based on seed
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// All possible attack types with baseline weights
const ATTACK_TYPES = [
  { type: 'SQL Injection', weight: 25, isPrimary: true },
  { type: 'Credential Stuffing', weight: 20, isPrimary: true },
  { type: 'DDoS', weight: 15, isPrimary: true },
  { type: 'Bot Attack', weight: 18, isPrimary: true },
  { type: 'Scanner Activity', weight: 12, isPrimary: false },
  { type: 'Rate Limit', weight: 10, isPrimary: false },
  { type: 'Auth Failure', weight: 8, isPrimary: false },
  { type: 'Bot Activity', weight: 7, isPrimary: false },
  { type: 'XSS Attempt', weight: 6, isPrimary: true },
  { type: 'Path Traversal', weight: 5, isPrimary: true },
  { type: 'Command Injection', weight: 4, isPrimary: true },
  { type: 'SSRF Attempt', weight: 3, isPrimary: true },
  { type: 'API Abuse', weight: 5, isPrimary: false },
  { type: 'Session Hijacking', weight: 3, isPrimary: true },
  { type: 'Brute Force', weight: 8, isPrimary: false },
];

export interface AttackPatternsDataResult {
  patterns: AttackPattern[];
}

/**
 * Generate attack pattern data for the given scenario.
 */
export function generateAttackPatternsData(
  scenario: DemoScenario
): AttackPatternsDataResult {
  const profile = getScenarioProfile(scenario);
  const rand = seededRandom(
    scenario === 'high-threat' ? 222 : scenario === 'normal' ? 333 : 444
  );

  const threatCount = profile.threats.count;
  const primaryTypes = profile.threats.primaryTypes;

  // Build weighted list based on scenario
  const weightedTypes = buildWeightedTypes(scenario, primaryTypes, rand);

  // Calculate total weight for normalization
  const totalWeight = weightedTypes.reduce((sum, t) => sum + t.weight, 0);

  // Generate patterns
  let runningPercentage = 0;
  const patterns: AttackPattern[] = [];

  for (let i = 0; i < weightedTypes.length; i++) {
    const { type, weight } = weightedTypes[i];

    // Calculate percentage (ensure they sum to 100)
    let percentage: number;
    if (i === weightedTypes.length - 1) {
      // Last item gets remaining percentage to ensure sum is 100
      percentage = Math.round((100 - runningPercentage) * 10) / 10;
    } else {
      percentage = Math.round((weight / totalWeight) * 1000) / 10;
    }

    runningPercentage += percentage;

    // Calculate count based on percentage
    const count = Math.round((percentage / 100) * threatCount);

    // Calculate trend based on scenario
    const trend = calculateTrend(scenario, type, primaryTypes, rand);

    // Only include if count > 0
    if (count > 0) {
      patterns.push({
        type,
        count,
        percentage,
        trend,
      });
    }
  }

  // Sort by count descending
  patterns.sort((a, b) => b.count - a.count);

  // Recalculate percentages to ensure they sum to exactly 100
  normalizePercentages(patterns);

  return {
    patterns,
  };
}

function buildWeightedTypes(
  scenario: DemoScenario,
  primaryTypes: string[],
  rand: () => number
): Array<{ type: string; weight: number }> {
  const result: Array<{ type: string; weight: number }> = [];

  for (const attackType of ATTACK_TYPES) {
    let weight = attackType.weight;

    // Boost primary types for the scenario
    if (primaryTypes.includes(attackType.type)) {
      weight *= scenario === 'high-threat' ? 3.0 : scenario === 'quiet' ? 1.5 : 2.0;
    }

    // Scenario-specific adjustments
    switch (scenario) {
      case 'high-threat':
        // Boost attack-type patterns
        if (attackType.isPrimary) {
          weight *= 1.5;
        }
        // Add more variance in high-threat
        weight *= 0.7 + rand() * 0.6;
        break;

      case 'quiet':
        // Reduce most attack types, keep scanners
        if (attackType.type !== 'Scanner Activity') {
          weight *= 0.3;
        }
        weight *= 0.8 + rand() * 0.4;
        break;

      default:
        // Normal: moderate variance
        weight *= 0.85 + rand() * 0.3;
        break;
    }

    // Only include types with meaningful weight
    if (weight > 0.5) {
      result.push({ type: attackType.type, weight });
    }
  }

  // Sort by weight descending
  return result.sort((a, b) => b.weight - a.weight);
}

function calculateTrend(
  scenario: DemoScenario,
  type: string,
  primaryTypes: string[],
  rand: () => number
): number {
  const isPrimary = primaryTypes.includes(type);

  switch (scenario) {
    case 'high-threat':
      // Primary attacks trending up sharply, others mixed
      if (isPrimary) {
        return Math.round((25 + rand() * 50) * 10) / 10;
      }
      return Math.round((rand() * 30 - 5) * 10) / 10;

    case 'quiet':
      // Most attacks trending down
      return Math.round((-10 - rand() * 20) * 10) / 10;

    default:
      // Normal: slight variance around zero
      return Math.round((rand() * 20 - 10) * 10) / 10;
  }
}

function normalizePercentages(patterns: AttackPattern[]): void {
  if (patterns.length === 0) return;

  const total = patterns.reduce((sum, p) => sum + p.percentage, 0);

  if (Math.abs(total - 100) > 0.1) {
    // Redistribute the difference
    const diff = 100 - total;
    patterns[0].percentage = Math.round((patterns[0].percentage + diff) * 10) / 10;
  }

  // Final validation - adjust largest if needed
  const finalTotal = patterns.reduce((sum, p) => sum + p.percentage, 0);
  if (finalTotal !== 100) {
    const adjustment = 100 - finalTotal;
    patterns[0].percentage =
      Math.round((patterns[0].percentage + adjustment) * 10) / 10;
  }
}
