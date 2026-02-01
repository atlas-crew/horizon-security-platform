import { memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ResponseTimeBucket {
  range: string;
  count: number;
  percentage: number;
}

interface ResponseTimeDistributionChartProps {
  data: ResponseTimeBucket[];
  className?: string;
}

// Atlas Crew brand colors from fast (green) to slow (magenta)
const bucketColors = [
  '#00B140', // <25ms - Atlas Crew Green (fast)
  '#00B140', // 25-50ms - Atlas Crew Green
  '#529EEC', // 50-100ms - Sky Blue (ok)
  '#E35205', // 100-250ms - Atlas Crew Orange (slow)
  '#D62598', // 250-500ms - Atlas Crew Magenta (critical)
  '#D62598', // >500ms - Atlas Crew Magenta
];

/**
 * ResponseTimeDistributionChart - Vertical bar chart showing response time distribution.
 * Colors gradient from green (fast) to red (slow).
 */
export const ResponseTimeDistributionChart = memo(function ResponseTimeDistributionChart({
  data,
  className = '',
}: ResponseTimeDistributionChartProps) {
  return (
    <div className={`h-64 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
        >
          <XAxis
            dataKey="range"
            tick={{ fontSize: 11, fill: '#7B8FA8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#7B8FA8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            formatter={(value: number, _name: string) => [
              `${value.toFixed(1)}%`,
              'Requests',
            ]}
            contentStyle={{
              backgroundColor: '#001544',
              border: '1px solid rgba(0, 87, 183, 0.4)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              borderRadius: '0',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
            itemStyle={{ color: '#B0C4DE' }}
          />
          <Bar dataKey="percentage">
            {data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={bucketColors[Math.min(index, bucketColors.length - 1)]}
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
