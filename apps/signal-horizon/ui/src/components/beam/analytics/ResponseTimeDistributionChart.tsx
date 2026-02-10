import { memo, useMemo } from 'react';
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
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_ITEM_STYLE,
  lighten,
  darken,
  getGridStroke,
  getCursorFill,
  getValueLabelStyle,
} from '../../../lib/chartTheme';

interface ResponseTimeBucket {
  range: string;
  count: number;
  percentage: number;
}

interface ResponseTimeDistributionChartProps {
  data: ResponseTimeBucket[];
  className?: string;
}

// Latency buckets are time ranges; keep them one color and only warn/danger at the tail.
const bucketColors = [
  '#0057B7', // <25ms - Atlas Crew Blue
  '#0057B7', // 25-50ms - Atlas Crew Blue
  '#0057B7', // 50-100ms - Atlas Crew Blue
  '#0057B7', // 100-250ms - Atlas Crew Blue
  '#E35205', // 250-500ms - Orange (warning)
  '#EF3340', // >500ms - Red (danger)
];

// Pre-compute unique colors for gradient defs
const uniqueBucketColors = [...new Set(bucketColors)];

/**
 * ResponseTimeDistributionChart - Vertical bar chart showing response time distribution.
 * Colors gradient from green (fast) to magenta (slow) per Atlas Crew chart standards.
 */
export const ResponseTimeDistributionChart = memo(function ResponseTimeDistributionChart({
  data,
  className = '',
}: ResponseTimeDistributionChartProps) {
  const gridStroke = useMemo(() => getGridStroke(), []);
  const cursorFill = useMemo(() => getCursorFill(), []);
  const valueLabelStyle = useMemo(() => getValueLabelStyle(), []);

  return (
    <div className={`h-64 ${className}`} role="img" aria-label="Bar chart showing response time distribution across latency buckets">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 24, right: 10, left: -10, bottom: 20 }}
        >
          <defs>
            {uniqueBucketColors.map((color) => (
              <linearGradient key={color} id={`bar-v-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lighten(color, 30)} />
                <stop offset="100%" stopColor={darken(color, 20)} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="range"
            tick={{ fontSize: 12, fontFamily: 'Rubik', fill: '#7F7F7F' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fontFamily: 'Rubik', fill: '#7F7F7F' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            formatter={(value: number, _name: string) => [
              `${value.toFixed(1)}%`,
              'Requests',
            ]}
            contentStyle={{ ...TOOLTIP_CONTENT_STYLE, fontSize: '12px', fontFamily: 'Rubik' }}
            labelStyle={{ ...TOOLTIP_LABEL_STYLE, fontWeight: 600 }}
            itemStyle={TOOLTIP_ITEM_STYLE}
            cursor={{ fill: cursorFill }}
          />
          <Bar dataKey="percentage" fillOpacity={0.9} radius={[0, 0, 0, 0]}>
            <LabelList
              dataKey="percentage"
              position="top"
              style={valueLabelStyle}
              formatter={(value: number) => `${value.toFixed(1)}%`}
            />
            {data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`url(#bar-v-${bucketColors[Math.min(index, bucketColors.length - 1)].replace('#', '')})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

// Demo data generator
export function generateResponseTimeData(): ResponseTimeBucket[] {
  return [
    { range: '<25ms', count: 45230, percentage: 38.2 },
    { range: '25-50ms', count: 32100, percentage: 27.1 },
    { range: '50-100ms', count: 21500, percentage: 18.2 },
    { range: '100-250ms', count: 12300, percentage: 10.4 },
    { range: '250-500ms', count: 5200, percentage: 4.4 },
    { range: '>500ms', count: 2100, percentage: 1.8 },
  ];
}

export default ResponseTimeDistributionChart;
