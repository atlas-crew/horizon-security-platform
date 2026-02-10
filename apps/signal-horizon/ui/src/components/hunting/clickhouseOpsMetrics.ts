import type { OpsMetricSnapshot } from '../../hooks/useHunt';

export type LabeledValue = {
  value: number;
  metricName?: string;
  labels?: Record<string, string | number>;
};

export function getValues(metric: OpsMetricSnapshot | undefined): LabeledValue[] {
  if (!metric) return [];
  if (!Array.isArray((metric as any).values)) return [];
  return (metric.values as unknown as LabeledValue[]) ?? [];
}

export function asString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

export function byOpGauge(metric: OpsMetricSnapshot | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of getValues(metric)) {
    const op = asString(v.labels?.op);
    if (!op) continue;
    out[op] = typeof v.value === 'number' ? v.value : 0;
  }
  return out;
}

export function queueDepthByOp(metric: OpsMetricSnapshot | undefined): Record<string, { query: number; stream: number }> {
  const out: Record<string, { query: number; stream: number }> = {};
  for (const v of getValues(metric)) {
    const op = asString(v.labels?.op);
    const queue = asString(v.labels?.queue);
    if (!op || !queue) continue;
    if (!out[op]) out[op] = { query: 0, stream: 0 };
    const n = typeof v.value === 'number' ? v.value : 0;
    if (queue === 'query') out[op].query = n;
    if (queue === 'stream') out[op].stream = n;
  }
  return out;
}

export function histogramSumCountByOp(metric: OpsMetricSnapshot | undefined): Record<string, { sum: number; count: number }> {
  const out: Record<string, { sum: number; count: number }> = {};
  for (const v of getValues(metric)) {
    const op = asString(v.labels?.op);
    if (!op) continue;
    const metricName = typeof v.metricName === 'string' ? v.metricName : '';
    if (!out[op]) out[op] = { sum: 0, count: 0 };
    if (metricName.endsWith('_sum')) out[op].sum = v.value;
    if (metricName.endsWith('_count')) out[op].count = v.value;
  }
  return out;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return 'n/a';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

