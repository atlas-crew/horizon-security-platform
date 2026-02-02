import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { getTooltipStyle, getAxisTickColor, getGridStroke, getCursorFill } from '../../../lib/chartTheme';

// Demo Data: Distribution of request latencies (Atlas Crew brand colors)
const DEMO_LATENCY_DATA = [
  { bucket: '0-50ms', count: 45000, color: '#00B140' },    // Fast (Atlas Crew Green)
  { bucket: '50-100ms', count: 28000, color: '#00B140' },
  { bucket: '100-200ms', count: 12000, color: '#0057B7' }, // OK (Atlas Crew Blue)
  { bucket: '200-500ms', count: 5000, color: '#529EEC' },  // Slow (Sky Blue)
  { bucket: '500ms-1s', count: 1200, color: '#E35205' },   // Warning (Atlas Crew Orange)
  { bucket: '1s+', count: 450, color: '#D62598' },         // Critical (Atlas Crew Magenta)
];

export function LatencyHistogram() {
  const tooltipStyle = useMemo(() => getTooltipStyle(), []);
  const tickColor = useMemo(() => getAxisTickColor(), []);
  const gridStroke = useMemo(() => getGridStroke(), []);
  const cursorFill = useMemo(() => getCursorFill(), []);

  return (
    <div className="bg-surface-card border border-border-subtle p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold text-ink-primary">Latency Distribution</h3>
          <p className="text-sm text-ink-secondary">Request processing time buckets</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-secondary uppercase tracking-wider">P95 Latency</p>
          <p className="text-xl font-mono text-ink-primary">184ms</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DEMO_LATENCY_DATA} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="bucket"
              tick={{ fill: tickColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            />
            <Tooltip
              cursor={{ fill: cursorFill }}
              contentStyle={tooltipStyle.contentStyle}
              labelStyle={tooltipStyle.labelStyle}
              itemStyle={tooltipStyle.itemStyle}
              formatter={(value: number) => [value.toLocaleString(), 'Requests']}
            />
            <Bar dataKey="count" radius={[0, 0, 0, 0]}>
              {DEMO_LATENCY_DATA.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
