/**
 * ToggleSwitch Component
 *
 * Accessible toggle switch with design token styling.
 * Replaces custom div-based toggles with proper ARIA semantics.
 */

import { clsx } from 'clsx';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Visible label or descriptive text for screen readers */
  label?: string;
  /** ID of an element that labels this toggle */
  'aria-labelledby'?: string;
  /** Explicit ARIA label if no visible label is provided */
  'aria-label'?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  'aria-labelledby': ariaLabelledBy,
  'aria-label': ariaLabel,
  size = 'md',
}: ToggleSwitchProps) {
  // Enforce accessibility labels in development
  if (process.env.NODE_ENV === 'development' && !label && !ariaLabel && !ariaLabelledBy) {
    console.warn('ToggleSwitch requires a "label", "aria-label", or "aria-labelledby" prop for accessibility.');
  }

  const sizeStyles = size === 'sm'
    ? { track: 'w-10 h-5', thumb: 'w-3 h-3', on: 'translate-x-5', off: 'translate-x-1' }
    : { track: 'w-12 h-6', thumb: 'w-4 h-4', on: 'translate-x-6', off: 'translate-x-1' };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      aria-labelledby={ariaLabelledBy}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={clsx(
        sizeStyles.track,
        'relative inline-flex items-center rounded-none transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ac-blue focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-status-success' : 'bg-border-subtle',
      )}
    >
      <span
        className={clsx(
          sizeStyles.thumb,
          'block bg-white shadow-sm transition-transform',
          checked ? sizeStyles.on : sizeStyles.off,
        )}
      />
    </button>
  );
}
