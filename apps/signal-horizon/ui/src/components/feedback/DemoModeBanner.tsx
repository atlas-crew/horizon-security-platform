import { AlertTriangle, RefreshCw, X, Shield, Moon, Settings } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import type { DemoScenario } from '../../stores/demoModeStore';
import { SCENARIO_PROFILES } from '../../lib/demoData/scenarios';
import { Stack } from '@/ui';

interface DemoModeBannerProps {
  /** Current demo scenario */
  scenario?: DemoScenario;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Callback when switch scenario is clicked */
  onSwitchScenario?: () => void;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** Custom message to display (overrides scenario message) */
  message?: string;
  /** Variant style */
  variant?: 'demo' | 'fallback';
}

const SCENARIO_ICONS: Record<DemoScenario, typeof AlertTriangle> = {
  'high-threat': AlertTriangle,
  normal: Shield,
  quiet: Moon,
};

const SCENARIO_STYLES: Record<DemoScenario, { border: string; bg: string; icon: string; text: string }> = {
  'high-threat': {
    border: 'border-ac-red/30',
    bg: 'bg-ac-red/10',
    icon: 'text-ac-red',
    text: 'text-ink-primary',
  },
  normal: {
    border: 'border-ac-green/30',
    bg: 'bg-ac-green/10',
    icon: 'text-ac-green',
    text: 'text-ink-primary',
  },
  quiet: {
    border: 'border-ac-cyan/30',
    bg: 'bg-ac-cyan/10',
    icon: 'text-ac-cyan',
    text: 'text-ink-primary',
  },
};

/**
 * Banner displayed when viewing demo/fallback data instead of live API data
 */
export function DemoModeBanner({
  scenario,
  onRetry,
  onSwitchScenario,
  dismissible = false,
  message,
  variant = 'demo',
}: DemoModeBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  // Determine styling based on variant and scenario
  const styles = scenario ? SCENARIO_STYLES[scenario] : {
    border: 'border-ac-magenta/30',
    bg: 'bg-ac-magenta/10',
    icon: 'text-ac-magenta',
    text: 'text-ink-primary',
  };

  const Icon = scenario ? SCENARIO_ICONS[scenario] : AlertTriangle;
  const profile = scenario ? SCENARIO_PROFILES[scenario] : null;

  // Build display message
  const displayMessage = message || (
    variant === 'demo' && profile
      ? `Demo Mode: ${profile.label} — ${profile.description}`
      : 'Viewing demo data. Live connection unavailable.'
  );

  return (
    <Stack
      role="status"
      aria-live="polite"
      direction="row"
      align="center"
      justify="space-between"
      style={{ gap: '12px' }}
      className={clsx(
        'border px-4 py-3 mb-4',
        styles.border,
        styles.bg
      )}
    >
      <Stack direction="row" align="center" style={{ gap: '12px' }}>
        <Icon className={clsx('h-5 w-5 flex-shrink-0', styles.icon)} aria-hidden="true" />
        <span className={clsx('text-sm font-medium', styles.text)}>{displayMessage}</span>
      </Stack>

      <Stack direction="row" align="center" gap="sm">
        {onSwitchScenario && variant === 'demo' && (
          <button
            type="button"
            onClick={onSwitchScenario}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              'bg-surface-card border border-border-subtle text-ink-secondary',
              'hover:bg-surface-subtle hover:text-ink-primary',
              'focus:outline-none focus:ring-2 focus:ring-link'
            )}
          >
            <Stack direction="row" align="center" style={{ gap: '6px' }}>
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Switch Scenario</span>
            </Stack>
          </button>
        )}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              'bg-surface-card border border-border-subtle text-ink-secondary',
              'hover:bg-surface-subtle hover:text-ink-primary',
              'focus:outline-none focus:ring-2 focus:ring-link'
            )}
          >
            <Stack direction="row" align="center" style={{ gap: '6px' }}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry Connection</span>
            </Stack>
          </button>
        )}

        {dismissible && (
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </Stack>
    </Stack>
  );
}

export default DemoModeBanner;
