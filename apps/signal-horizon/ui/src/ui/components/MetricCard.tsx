import { memo, type ReactNode, type CSSProperties } from 'react';
import { clsx } from 'clsx';

/**
 * MetricCard — Single KPI display with optional trend, icon, and accents.
 *
 * Unified canonical version of the design system metric card. Replaces
 * both the previous inline-style `@/ui` MetricCard and the Tailwind-based
 * `components/fleet/MetricCard`, which had drifted into two parallel
 * components with overlapping but distinct APIs.
 *
 * Usage:
 *   <MetricCard label="P95 Latency" value="17μs" />
 *   <MetricCard
 *     label="Critical Alerts"
 *     value={count}
 *     description="Sensors offline or with CPU/memory above 90%"
 *     className="border-l-2 border-l-ac-red"
 *     labelClassName="text-ac-red"
 *     valueClassName="text-ac-red"
 *   />
 *   <MetricCard
 *     label="Total Requests"
 *     value="88.7k"
 *     subtitle="across all sensors"
 *     trend={{ value: 12, label: 'vs previous' }}
 *     icon={<Activity className="w-6 h-6" />}
 *   />
 *   <MetricCard
 *     label="Status"
 *     value="Online"
 *     borderColor="var(--ac-green)"
 *     valueColor="var(--ac-green)"
 *     onClick={() => navigate('/status')}
 *   />
 *
 * ## API surface
 *
 * **Core:**
 * - `label`, `value` — required
 *
 * **Secondary content:**
 * - `description` — tooltip on the label, explains what this metric MEANS
 * - `subtitle` — small text below value, says what this metric IS RIGHT NOW
 *
 * **Trend indicator:**
 * - `trend: { value: number; label?: string; direction?: 'up'|'down'|'neutral' }`
 *   The sign of `value` infers the direction (positive = up = green) unless
 *   `direction` is set explicitly. `label` adds optional context like
 *   "vs previous" or "since 9am".
 *
 * **Visuals:**
 * - `icon` — ReactNode rendered to the right of the value
 * - `borderColor` — left-border accent. Inline style; pass a CSS color or
 *   `var(--ac-blue)` etc. Use this OR a `border-l-*` className, not both.
 * - `valueColor` — overrides the value text color (inline style)
 * - `size: 'compact' | 'default' | 'large'` — padding + value font size
 *
 * **Escape hatches:**
 * - `className` — applied to the outer card. Use for `border-l-2 border-l-*`
 *   accents and other one-off layout tweaks.
 * - `labelClassName`, `valueClassName` — for tinting label/value text via
 *   Tailwind classes (e.g., `text-ac-red`)
 *
 * **Interaction:**
 * - `onClick` — turns the card into a clickable button
 *
 * ## What's NOT here
 *
 * - `variant="ctrlx"` (top accent + colored value treatment) — the previous
 *   fleet MetricCard had this but zero callers used it. If you need it
 *   later, add it as a separate exported component (e.g., `<HeroMetric>`)
 *   rather than overloading this one with a variant prop.
 * - String-based `trend` — only the showcase used it; the object shape is
 *   richer and more typed. Convert `trend="+12%"` → `trend={{ value: 12 }}`.
 */

interface MetricCardTrend {
  /** Numeric trend value. Sign infers direction (positive=up, negative=down). */
  value: number;
  /** Optional context label, e.g., "vs previous", "since 9am". */
  label?: string;
  /** Override the sign-inferred direction. */
  direction?: 'up' | 'down' | 'neutral';
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  /** Tooltip text on the label, explaining what this metric means. */
  description?: string;
  /** Small text below the value (e.g., "+2 from yesterday"). */
  subtitle?: string;
  /** Trend indicator. Sign of `value` infers direction unless overridden. */
  trend?: MetricCardTrend;
  /** ReactNode rendered to the right of the value. */
  icon?: ReactNode;
  /** Left-border accent color (CSS color string). */
  borderColor?: string;
  /** Value text color override (CSS color string). */
  valueColor?: string;
  /** Size variant — affects padding and value font size. */
  size?: 'compact' | 'default' | 'large';
  /** Click handler. Adds cursor + hover affordance. */
  onClick?: () => void;
  /** Outer card className. Use for `border-l-*` accents and layout tweaks. */
  className?: string;
  /** className applied to the label text (for tinting). */
  labelClassName?: string;
  /** className applied to the value text (for tinting). */
  valueClassName?: string;
  /** Additional inline styles on the outer card. */
  style?: CSSProperties;
}

// Size → padding + value font size. Tailwind classes here so callers can
// override via `className`.
const sizeClasses: Record<NonNullable<MetricCardProps['size']>, { padding: string; valueText: string; labelText: string }> = {
  compact: { padding: 'p-3', valueText: 'text-xl', labelText: 'text-[11px]' },
  default: { padding: 'p-6', valueText: 'text-3xl', labelText: 'text-sm' },
  large: { padding: 'p-6', valueText: 'text-4xl', labelText: 'text-base' },
};

// Resolve trend direction from explicit prop OR sign of value.
function resolveTrendDirection(trend: MetricCardTrend): 'up' | 'down' | 'neutral' {
  if (trend.direction) return trend.direction;
  if (trend.value > 0) return 'up';
  if (trend.value < 0) return 'down';
  return 'neutral';
}

const trendArrow: Record<'up' | 'down' | 'neutral', string> = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

const trendColorClass: Record<'up' | 'down' | 'neutral', string> = {
  up: 'text-ac-green',
  down: 'text-ac-red',
  neutral: 'text-ink-muted',
};

export const MetricCard = memo(function MetricCard({
  label,
  value,
  description,
  subtitle,
  trend,
  icon,
  borderColor,
  valueColor,
  size = 'default',
  onClick,
  className,
  labelClassName,
  valueClassName,
  style,
}: MetricCardProps) {
  const sz = sizeClasses[size];

  // borderColor is applied via inline style so callers can pass either a
  // hex/rgb color or a `var(--ac-*)` CSS variable. The className escape
  // hatch (`border-l-2 border-l-ac-red`) still works for cases where
  // Tailwind classes are preferred — they layer on top of the base border.
  const borderStyle: CSSProperties = borderColor
    ? { borderLeft: `4px solid ${borderColor}` }
    : {};

  const direction = trend ? resolveTrendDirection(trend) : 'neutral';

  // Card chrome matches what <Panel> produces: surface-card background,
  // subtle border, card shadow. This replaces the dead `.card` CSS class
  // the fleet variant used to depend on.
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={clsx(
        'bg-surface-card border border-border-subtle shadow-card text-left w-full',
        sz.padding,
        onClick && 'cursor-pointer hover:border-border-medium transition-colors',
        className,
      )}
      style={{ ...borderStyle, ...style }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Label — with optional tooltip via title attribute */}
          <p
            className={clsx(
              'font-medium text-ink-secondary',
              sz.labelText,
              labelClassName,
            )}
            title={description}
          >
            {label}
          </p>

          {/* Value */}
          <p
            className={clsx(
              'mt-2 font-light text-ink-primary',
              sz.valueText,
              valueClassName,
            )}
            style={valueColor ? { color: valueColor } : undefined}
            aria-live="polite"
          >
            {value}
          </p>

          {/* Subtitle (optional secondary content) */}
          {subtitle && (
            <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>
          )}

          {/* Trend indicator (optional) */}
          {trend && (
            <p className={clsx('mt-2 text-sm font-medium', trendColorClass[direction])}>
              {trendArrow[direction]} {Math.abs(trend.value)}
              {typeof trend.value === 'number' && '%'}
              {trend.label ? ` ${trend.label}` : ''}
            </p>
          )}
        </div>

        {/* Icon (right-aligned, top-aligned with the label) */}
        {icon && <div className="text-ac-blue flex-shrink-0">{icon}</div>}
      </div>
    </Tag>
  );
});

MetricCard.displayName = 'MetricCard';
