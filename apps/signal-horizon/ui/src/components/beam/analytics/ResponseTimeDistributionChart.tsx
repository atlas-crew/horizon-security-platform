import { memo } from 'react';
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
  axisDefaults,
  ChartValueLabel,
  colors,
  darken,
  gridDefaults,
  lighten,
  tooltipDefaults,
  xAxisNoLine,
} from '@/ui';

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
  colors.blue,
  colors.blue,
  colors.blue,
  colors.blue,
  colors.orange,
  colors.red,
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
          <CartesianGrid {...gridDefaults} />
          <XAxis
            dataKey="range"
            {...xAxisNoLine}
          />
          <YAxis
            {...axisDefaults.y}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            formatter={(value: number, _name: string) => [
              `${value.toFixed(1)}%`,
              'Requests',
            ]}
            {...tooltipDefaults}
          />
          <Bar dataKey="percentage" fillOpacity={0.9} radius={[0, 0, 0, 0]}>
            <LabelList
              dataKey="percentage"
              content={<ChartValueLabel formatter={(value: number) => `${value.toFixed(1)}%`} />}
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
