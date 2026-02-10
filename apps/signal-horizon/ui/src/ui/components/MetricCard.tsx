import React from 'react';
import { colors, fontFamily, fontWeight, spacing, shadows } from '../tokens/tokens';

/**
 * MetricCard — Single KPI display with colored left border.
 *
 * Usage:
 *   <MetricCard label="P95 Latency" value="17μs" />
 *   <MetricCard label="Requests" value="45.2k" trend="+12%" trendDirection="up" />
 *   <MetricCard label="Blocked" value="1,204" borderColor={colors.red} />
 *   <MetricCard label="Status" value="Online" size="compact" />
 */

interface MetricCardProps {
  label: string;
  value: string | number;
  /** Optional secondary info below value */
  subtitle?: string;
  /** Trend indicator */
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  /** Left border color - defaults to Atlas Crew Blue */
  borderColor?: string;
  /** Size variant */
  size?: 'default' | 'compact' | 'large';
  /** Value color override (e.g., green for good, red for bad) */
  valueColor?: string;
  /** Optional icon or element to the left of value */
  icon?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  style?: React.CSSProperties;
}

const sizeMap = {
  compact: {
    padding: `${spacing.sm} ${spacing.md}`,
    valueSize: '20px',
    labelSize: '11px',
  },
  default: {
    padding: spacing.lg,
    valueSize: '28px',
    labelSize: '12px',
  },
  large: {
    padding: spacing.lg,
    valueSize: '36px',
    labelSize: '14px',
  },
};

const trendColors = {
  up: colors.green,
  down: colors.red,
  neutral: colors.gray.mid,
};

const trendArrows = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  trend,
  trendDirection = 'neutral',
  borderColor = colors.blue,
  size = 'default',
  valueColor = '#F0F4F8',
  icon,
  onClick,
  style,
}) => {
  const s = sizeMap[size];

  return (
    <div
      onClick={onClick}
      style={{
        background: colors.card.dark,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 0,
        padding: s.padding,
        boxShadow: shadows.card.dark,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease',
        minWidth: size === 'compact' ? '120px' : '160px',
        ...style,
      }}
    >
      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm }}>
        {icon && <span style={{ marginRight: spacing.xs }}>{icon}</span>}
        <span
          style={{
            fontFamily,
            fontWeight: fontWeight.medium,
            fontSize: s.valueSize,
            lineHeight: 1.2,
            color: valueColor,
          }}
        >
          {value}
        </span>
        {trend && (
          <span
            style={{
              fontFamily,
              fontWeight: fontWeight.medium,
              fontSize: '13px',
              color: trendColors[trendDirection],
            }}
          >
            {trendArrows[trendDirection]} {trend}
          </span>
        )}
      </div>

      {/* Label */}
      <div
        style={{
          fontFamily,
          fontWeight: fontWeight.regular,
          fontSize: s.labelSize,
          color: colors.gray.mid,
          marginTop: spacing.xs,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div
          style={{
            fontFamily,
            fontWeight: fontWeight.regular,
            fontSize: '12px',
            color: colors.gray.mid,
            marginTop: '2px',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

MetricCard.displayName = 'MetricCard';
