import { describe, expect, it } from 'vitest';
import type { OpsMetricSnapshot } from '../../hooks/useHunt';
import { asString, byOpGauge, formatMs, getValues, histogramSumCountByOp, queueDepthByOp } from './clickhouseOpsMetrics';

describe('clickhouseOpsMetrics', () => {
  it('getValues returns [] for undefined or malformed metrics', () => {
    expect(getValues(undefined)).toEqual([]);
    expect(getValues({ name: 'x', help: 'x', type: 'gauge', values: 'bad' as any } as OpsMetricSnapshot)).toEqual([]);
  });

  it('asString converts finite numbers and returns null for non-string/non-finite', () => {
    expect(asString('a')).toBe('a');
    expect(asString(42)).toBe('42');
    expect(asString(NaN)).toBeNull();
    expect(asString(Infinity)).toBeNull();
    expect(asString(null)).toBeNull();
    expect(asString({})).toBeNull();
  });

  it('byOpGauge extracts op-keyed values and skips missing ops', () => {
    const metric = {
      name: 'g',
      help: 'g',
      type: 'gauge',
      values: [
        { value: 2, labels: { op: 'a' } },
        { value: 3, labels: { op: 'b' } },
        { value: 999, labels: {} },
      ],
    } as OpsMetricSnapshot;

    expect(byOpGauge(metric)).toEqual({ a: 2, b: 3 });
  });

  it('queueDepthByOp separates query vs stream by op and ignores unknown queues', () => {
    const metric = {
      name: 'q',
      help: 'q',
      type: 'gauge',
      values: [
        { value: 1, labels: { op: 'a', queue: 'query' } },
        { value: 2, labels: { op: 'a', queue: 'stream' } },
        { value: 3, labels: { op: 'b', queue: 'query' } },
        { value: 9, labels: { op: 'a', queue: 'unknown' } },
        { value: 9, labels: { queue: 'query' } },
      ],
    } as OpsMetricSnapshot;

    expect(queueDepthByOp(metric)).toEqual({
      a: { query: 1, stream: 2 },
      b: { query: 3, stream: 0 },
    });
  });

  it('histogramSumCountByOp extracts sum/count by metricName suffix', () => {
    const metric = {
      name: 'h',
      help: 'h',
      type: 'histogram',
      values: [
        { value: 0.2, metricName: 'x_sum', labels: { op: 'a' } },
        { value: 4, metricName: 'x_count', labels: { op: 'a' } },
        { value: 1, metricName: 'x_bucket', labels: { op: 'a', le: 0.1 } },
        { value: 1.0, metricName: 'y_sum', labels: { op: 'b' } },
        { value: 2, metricName: 'y_count', labels: { op: 'b' } },
        { value: 9, labels: { op: 'c' } },
      ],
    } as OpsMetricSnapshot;

    expect(histogramSumCountByOp(metric)).toEqual({
      a: { sum: 0.2, count: 4 },
      b: { sum: 1.0, count: 2 },
      c: { sum: 0, count: 0 },
    });
  });

  it('formatMs formats null, sub-ms, ms, and seconds', () => {
    expect(formatMs(null)).toBe('n/a');
    expect(formatMs(0)).toBe('<1ms');
    expect(formatMs(0.5)).toBe('<1ms');
    expect(formatMs(50)).toBe('50ms');
    expect(formatMs(999)).toBe('999ms');
    expect(formatMs(1000)).toBe('1.0s');
    expect(formatMs(1500)).toBe('1.5s');
  });
});

