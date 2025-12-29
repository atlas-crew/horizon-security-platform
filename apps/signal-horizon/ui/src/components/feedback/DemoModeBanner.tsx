import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

interface DemoModeBannerProps {
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** Custom message to display */
  message?: string;
}

/**
 * Banner displayed when viewing demo/fallback data instead of live API data
 */
export function DemoModeBanner({
  onRetry,
  dismissible = false,
  message = 'Viewing demo data. Live connection unavailable.',
}: DemoModeBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-4"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" aria-hidden="true" />
        <span className="text-sm font-medium text-amber-200">{message}</span>
      </div>

      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        )}

        {dismissible && (
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="rounded-md p-1 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
