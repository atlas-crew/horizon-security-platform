import React from 'react';
import { spacing, kpiBorderColors } from '../tokens/tokens';
import { MetricCard } from './MetricCard';

/**
 * KpiStrip — Horizontal row of MetricCards with auto-cycling border colors.
 *
 * Usage:
 *   <KpiStrip
 *     metrics={[
 *       { label: 'RPS', value: '12.4k' },
 *       { label: 'P95', value: '17μs', valueColor: colors.green },
 *       { label: 'Blocked', value: '342', borderColor: colors.red },
 *     ]}
 *   />
 *
 *   <KpiStrip metrics={metrics} size="compact" cols={4} />
 */

interface KpiMetric {
  label: string;
  value: string | number;
  subtitle?: string;
  /** Trend indicator. Sign of `value` infers direction unless overridden. */
  trend?: {
    value: number;
    label?: string;
    direction?: 'up' | 'down' | 'neutral';
  };
  /** Override auto-cycled border color */
  borderColor?: string;
  /** Override value color */
  valueColor?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

interface KpiStripProps {
  metrics: KpiMetric[];
  /** Card size variant */
  size?: 'default' | 'compact' | 'large';
  /** Number of columns (defaults to number of metrics) */
  cols?: number;
  /** Gap between cards */
  gap?: keyof typeof spacing;
  style?: React.CSSProperties;
}

export const KpiStrip: React.FC<KpiStripProps> = ({
  metrics,
  size = 'default',
  cols,
  gap = 'md',
  style,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols || metrics.length}, 1fr)`,
      gap: spacing[gap],
      width: '100%',
      ...style,
    }}
  >
    {metrics.map((metric, i) => (
      <MetricCard
        key={metric.label}
        label={metric.label}
        value={metric.value}
        subtitle={metric.subtitle}
        trend={metric.trend}
        borderColor={metric.borderColor || kpiBorderColors[i % kpiBorderColors.length]}
        valueColor={metric.valueColor}
        icon={metric.icon}
        size={size}
        onClick={metric.onClick}
      />
    ))}
  </div>
);

KpiStrip.displayName = 'KpiStrip';
