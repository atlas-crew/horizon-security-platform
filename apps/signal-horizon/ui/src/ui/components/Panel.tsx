import React from 'react';
import { clsx } from 'clsx';

/**
 * Panel — Page-zone wrapper with semantic accent bar.
 *
 * Codifies the card pattern previously hand-rolled in AdminSettingsPage:
 * a `<section>` element with `bg-surface-card`, a 4px colored top accent
 * bar, generous padding, and an elevated shadow. Use Panel to group
 * related controls or data into a named zone on a page.
 *
 * This is the "page-zone" layer of the design system, distinct from the
 * "widget" layer owned by `MetricCard`, `ChartPanel`, and `StatCard`.
 * Zones wrap multiple widgets; widgets are self-contained data displays.
 *
 * Usage:
 *   <Panel tone="info">
 *     <SectionHeader title="Tenant Privacy" />
 *     <Stack gap="md">...</Stack>
 *   </Panel>
 *
 *   <Panel tone="destructive" padding="lg" spacing="md">
 *     <SectionHeader title="Danger Zone" />
 *     <Button variant="magenta">Revoke All Tokens</Button>
 *   </Panel>
 *
 *   <Panel tone="advanced" as="div">
 *     (renders as <div> instead of <section>)
 *   </Panel>
 *
 * ## Tone vocabulary
 *
 * | tone          | accent color         | when to use                                    |
 * |---------------|----------------------|------------------------------------------------|
 * | `default`     | neutral border       | informational zones, summaries                 |
 * | `info`        | ac-blue              | primary/core settings, main control zones      |
 * | `warning`     | ac-orange            | cautionary zones, impactful but recoverable    |
 * | `destructive` | status-error (red)   | danger zones — deletions, revocations, resets  |
 * | `advanced`    | ac-magenta           | advanced/expert-mode controls, experimental    |
 * | `system`      | ink-muted            | system info, read-only metadata                |
 *
 * The semantic color coding teaches users "red top bar = destructive,
 * magenta = advanced" across the entire app, not just AdminSettings.
 * Apply the same `tone` consistently when the same kind of action
 * appears in a different page.
 *
 * ## Padding
 *
 * - `sm` = p-4   (16px) — compact data panels, sidebars
 * - `md` = p-6   (24px) — standard control zones
 * - `lg` = p-8   (32px) — [default] primary page sections, matches
 *                        the AdminSettings feel
 *
 * ## Spacing (internal vertical rhythm)
 *
 * Adds `space-y-*` between direct children. Matches the AdminSettings
 * pattern of `space-y-6` inside each `<section>`.
 *
 * - `none` = no internal spacing (children manage their own)
 * - `sm`   = space-y-3
 * - `md`   = space-y-6 [default]
 * - `lg`   = space-y-8
 */

export type PanelTone =
  | 'default'
  | 'info'
  | 'warning'
  | 'destructive'
  | 'advanced'
  | 'system';

export type PanelPadding = 'sm' | 'md' | 'lg';

export type PanelSpacing = 'none' | 'sm' | 'md' | 'lg';

type PanelElement = 'section' | 'div' | 'article' | 'aside';

interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Semantic color of the top accent bar. See tone vocabulary table
   * in the component docstring.
   */
  tone?: PanelTone;
  /**
   * Internal padding. Defaults to 'lg' (p-8) to match the AdminSettings
   * feel. Use 'sm' for compact panels, 'md' for standard control zones.
   */
  padding?: PanelPadding;
  /**
   * Internal vertical rhythm between direct children. Defaults to 'md'
   * (space-y-6) matching AdminSettings. Use 'none' if the children
   * manage their own spacing.
   */
  spacing?: PanelSpacing;
  /**
   * Polymorphic element tag. Defaults to `section` for semantic HTML.
   * Use `div` when the panel is not a top-level page zone, or `article`
   * for self-contained content blocks.
   */
  as?: PanelElement;
  /**
   * Hide the top accent bar entirely. Use sparingly — the accent is
   * part of Panel's identity and omitting it makes the panel harder
   * to distinguish from an inline bordered div. Intended for nested
   * panels where an outer panel already provides the accent.
   */
  noAccent?: boolean;
}

const toneAccentClass: Record<PanelTone, string> = {
  default: 'border-border-subtle',
  info: 'border-ac-blue',
  warning: 'border-ac-orange',
  destructive: 'border-status-error',
  advanced: 'border-ac-magenta',
  system: 'border-ink-muted',
};

const paddingClass: Record<PanelPadding, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const spacingClass: Record<PanelSpacing, string> = {
  none: '',
  sm: 'space-y-3',
  md: 'space-y-6',
  lg: 'space-y-8',
};

export const Panel: React.FC<PanelProps> = ({
  tone = 'default',
  padding = 'lg',
  spacing = 'md',
  as = 'section',
  noAccent = false,
  className,
  children,
  ...rest
}) => {
  const Component = as as keyof React.JSX.IntrinsicElements;
  const classes = clsx(
    'bg-surface-card shadow-card',
    noAccent ? 'border border-border-subtle' : ['border-t-4', toneAccentClass[tone]],
    paddingClass[padding],
    spacingClass[spacing],
    className,
  );
  return React.createElement(Component, { className: classes, ...rest }, children);
};
