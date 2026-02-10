import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import {
  getTooltipStyle,
  getAxisTickColor,
  getGridStroke,
  getCursorFill,
  lighten,
  darken,
  getValueLabelStyle,
  formatChartValue,
} from '../../../lib/chartTheme';

// Demo Data: Distribution of request latencies (Atlas Crew brand chart colors)
const DEMO_LATENCY_DATA = [
  { bucket: '0-50ms', count: 45000, color: '#0057B7' },    // Primary (Atlas Crew Blue)
  { bucket: '50-100ms', count: 28000, color: '#0057B7' },
  { bucket: '100-200ms', count: 12000, color: '#0057B7' },
  { bucket: '200-500ms', count: 5000, color: '#0057B7' },
  { bucket: '500ms-1s', count: 1200, color: '#E35205' },   // Warning (Orange)
  { bucket: '1s+', count: 450, color: '#EF3340' },         // Danger (Red)
];

// Pre-compute unique colors for gradient defs
const uniqueColors = [...new Set(DEMO_LATENCY_DATA.map((d) => d.color))];

export function LatencyHistogram() {
  const tooltipStyle = useMemo(() => getTooltipStyle(), []);
  const tickColor = useMemo(() => getAxisTickColor(), []);
  const gridStroke = useMemo(() => getGridStroke(), []);
  const cursorFill = useMemo(() => getCursorFill(), []);
  const valueLabelStyle = useMemo(() => getValueLabelStyle(), []);

  return (
    <div className="bg-surface-card border border-border-subtle p-5 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xl font-light text-ink-primary">Latency Distribution</h3>
          <p className="text-sm text-ink-secondary">Request processing time buckets</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-secondary uppercase tracking-wider">P95 Latency</p>
          <p className="text-xl font-mono text-ink-primary">184ms</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DEMO_LATENCY_DATA} margin={{ top: 24, right: 0, left: 0, bottom: 0 }}>
            <defs>
              {uniqueColors.map((color) => (
                <linearGradient key={color} id={`bar-v-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lighten(color, 30)} />
                  <stop offset="100%" stopColor={darken(color, 20)} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="bucket"
              tick={{ fill: tickColor, fontSize: 12, fontFamily: 'Rubik' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 12, fontFamily: 'Rubik' }}
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
            <Bar dataKey="count" radius={[0, 0, 0, 0]} fillOpacity={0.9}>
              <LabelList
                dataKey="count"
                position="top"
                style={valueLabelStyle}
                formatter={(value: number) => formatChartValue(value)}
              />
              {DEMO_LATENCY_DATA.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`url(#bar-v-${entry.color.replace('#', '')})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
