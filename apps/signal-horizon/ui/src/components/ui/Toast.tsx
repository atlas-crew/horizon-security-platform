import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info';

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
  exiting: boolean;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success:
    'border-l-4 border-l-status-success bg-surface-card text-ink-primary',
  error:
    'border-l-4 border-l-status-error bg-surface-card text-ink-primary',
  info:
    'border-l-4 border-l-ac-blue bg-surface-card text-ink-primary',
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: '\u2713', // checkmark
  error: '\u2717',   // cross mark
  info: '\u2139',    // info symbol
};

const ICON_COLORS: Record<ToastVariant, string> = {
  success: 'text-status-success',
  error: 'text-status-error',
  info: 'text-ac-blue',
};

const AUTO_DISMISS_MS = 3000;
const EXIT_ANIMATION_MS = 200;

// ─── Toast Item ──────────────────────────────────────────────────────────────

function ToastItem({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`
        flex items-center gap-3 px-4 py-3 shadow-lg border border-border-subtle
        text-sm max-w-sm pointer-events-auto
        ${VARIANT_STYLES[entry.variant]}
        ${entry.exiting ? 'toast-exit' : 'toast-enter'}
      `}
    >
      <span className={`text-base font-bold flex-shrink-0 ${ICON_COLORS[entry.variant]}`}>
        {VARIANT_ICONS[entry.variant]}
      </span>
      <span className="flex-1">{entry.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(entry.id)}
        className="flex-shrink-0 text-ink-muted hover:text-ink-primary text-base leading-none"
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  );
}

// ─── Toast Container ─────────────────────────────────────────────────────────

function ToastContainer({ toasts, dismiss }: { toasts: ToastEntry[]; dismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((entry) => (
        <ToastItem key={entry.id} entry={entry} onDismiss={dismiss} />
      ))}
    </div>,
    document.body,
  );
}

// ─── CSS (injected once) ─────────────────────────────────────────────────────

let styleInjected = false;

function injectToastStyles() {
  if (styleInjected || typeof document === 'undefined') return;
  styleInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes toast-slide-in {
      from { opacity: 0; transform: translateX(100%); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes toast-slide-out {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(100%); }
    }
    .toast-enter {
      animation: toast-slide-in 200ms ease-out forwards;
    }
    .toast-exit {
      animation: toast-slide-out 200ms ease-in forwards;
    }
  `;
  document.head.appendChild(style);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  // Inject the CSS keyframe styles once on first mount
  useEffect(() => {
    injectToastStyles();
  }, []);

  const dismiss = useCallback((id: number) => {
    // Start the exit animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    // Remove after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_ANIMATION_MS);
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant, exiting: false }]);

      // Auto-dismiss
      setTimeout(() => {
        dismiss(id);
      }, AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'error'),
      info: (message: string) => show(message, 'info'),
    }),
    [show],
  );

  const container = <ToastContainer toasts={toasts} dismiss={dismiss} />;

  return { toast, Toasts: container };
}
