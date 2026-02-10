import React from 'react';
import { colors, fontFamily, fontWeight, spacing, shadows } from '../tokens/tokens';

/**
 * ChartPanel — Standardized chart container with title, subtitle, optional KPI callout.
 *
 * Usage:
 *   <ChartPanel title="Traffic Over Time" subtitle="Requests per hour">
 *     <YourRechartsComponent />
 *   </ChartPanel>
 *
 *   <ChartPanel
 *     title="Latency Distribution"
 *     subtitle="Request processing time buckets"
 *     kpi={{ label: 'P95 LATENCY', value: '184ms' }}
 *   >
 *     <BarChart ... />
 *   </ChartPanel>
 */

interface ChartKpi {
  label: string;
  value: string | number;
  color?: string;
}

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  /** Top-right KPI callout */
  kpi?: ChartKpi;
  /** Legend items - rendered as square markers */
  legend?: Array<{ label: string; color: string }>;
  /** Height of the chart area */
  height?: number | string;
  /** Optional actions slot (top-right, next to KPI) */
  actions?: React.ReactNode;
  /** Full-width or contained */
  fill?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ChartPanel: React.FC<ChartPanelProps> = ({
  title,
  subtitle,
  kpi,
  legend,
  height,
  actions,
  fill,
  style,
  children,
}) => (
  <div
    style={{
      background: colors.card.dark,
      padding: spacing.lg,
      borderRadius: 0,
      boxShadow: shadows.card.dark,
      width: fill ? '100%' : undefined,
      ...style,
    }}
  >
    {/* Header row */}
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
      }}
    >
      {/* Title block */}
      <div>
        <div
          style={{
            fontFamily,
            fontWeight: fontWeight.light,
            fontSize: '20px',
            color: '#F0F4F8',
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily,
              fontWeight: fontWeight.regular,
              fontSize: '14px',
              color: colors.gray.mid,
              marginTop: '2px',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Right side: KPI and/or actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
        {kpi && (
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily,
                fontWeight: fontWeight.regular,
                fontSize: '11px',
                color: colors.gray.mid,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {kpi.label}
            </div>
            <div
              style={{
                fontFamily,
                fontWeight: fontWeight.medium,
                fontSize: '28px',
                color: kpi.color || '#F0F4F8',
                lineHeight: 1.2,
              }}
            >
              {kpi.value}
            </div>
          </div>
        )}
        {actions}
      </div>
    </div>

    {/* Legend */}
    {legend && legend.length > 0 && (
      <div
        style={{
          display: 'flex',
          gap: spacing.md,
          marginBottom: spacing.md,
          flexWrap: 'wrap',
        }}
      >
        {legend.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                background: item.color,
                borderRadius: 0,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily,
                fontWeight: fontWeight.regular,
                fontSize: '12px',
                color: colors.gray.mid,
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    )}

    {/* Chart area */}
    <div style={{ height: height || 'auto', position: 'relative' }}>
      {children}
    </div>
  </div>
);

ChartPanel.displayName = 'ChartPanel';
