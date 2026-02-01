import { memo, type ReactNode } from 'react';
import { TrendIndicator, type TrendDirection } from './TrendIndicator';

export type MetricAccent = 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    direction: TrendDirection;
  };
  icon?: ReactNode;
  accent?: MetricAccent;
  subtitle?: string;
  className?: string;
}

/**
 * CtrlX MetricCard - Large number display with colored top border accent.
 * Matches the CtrlX design system mockups with light theme styling.
 */
export const MetricCard = memo(function MetricCard({
  label,
  value,
  trend,
  icon,
  accent = 'primary',
  subtitle,
  className = '',
}: MetricCardProps) {
  // Signal Horizon Design System: Magenta for primary metrics
  const accentColors: Record<MetricAccent, string> = {
    primary: 'bg-ac-magenta',
    success: 'bg-ac-green',
    warning: 'bg-ac-orange',
    danger: 'bg-ac-magenta',
    info: 'bg-ac-blue',
  };

  // Use Magenta for the single most important number, Atlas Crew Blue for secondary
  const valueColors: Record<MetricAccent, string> = {
    primary: 'text-ac-magenta',
    success: 'text-ac-green',
    warning: 'text-ac-orange',
    danger: 'text-ac-magenta',
    info: 'text-ac-blue',
  };

  return (
    <div
      className={`bg-surface-card border border-border-subtle shadow-sm p-4 relative overflow-hidden ${className}`}
    >
      {/* Colored top border accent */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentColors[accent]}`} />

      <div className="flex items-start justify-between pt-1">
        <div className="flex-1">
          {/* Large value - Rubik Light (300) per design system */}
          <p className={`text-3xl font-light ${valueColors[accent]}`}>
            {value}
          </p>

          {/* Eyebrow label - caps, small, tracked per design system */}
          <p className="mt-1 text-xs font-bold text-ink-muted uppercase tracking-[0.1em]">
            {label}
          </p>

          {/* Trend indicator */}
          {trend && (
            <div className="mt-2">
              <TrendIndicator
                value={trend.value}
                direction={trend.direction}
              />
            </div>
          )}

          {/* Optional subtitle */}
          {subtitle && (
            <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>
          )}
        </div>

        {/* Icon in top-right */}
        {icon && (
          <div className="text-ink-muted ml-2">{icon}</div>
        )}
      </div>
    </div>
  );
});

export default MetricCard;
