/**
 * Math Utilities for Analytics & Forecasting
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates a simple linear regression from a set of points.
 * Returns the slope (m) and y-intercept (b) for the line y = mx + b.
 */
export function linearRegression(points: Point[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Predicts the future value y for a given x using the linear model.
 */
export function predict(x: number, slope: number, intercept: number): number {
  return slope * x + intercept;
}

/**
 * Calculates days until a threshold is reached based on current slope.
 * Returns Infinity if slope is non-positive (trend is stable or decreasing).
 */
export function daysUntilThreshold(
  currentValue: number, 
  threshold: number, 
  dailySlope: number
): number {
  if (dailySlope <= 0) return Infinity;
  const remaining = threshold - currentValue;
  return Math.ceil(remaining / dailySlope);
}
