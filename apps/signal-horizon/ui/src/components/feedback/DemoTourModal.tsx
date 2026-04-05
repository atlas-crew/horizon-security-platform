import { useState } from 'react';
import { Play, AlertTriangle, Shield, Moon, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal, Stack } from '@/ui';
import { useDemoActions } from '../../stores/demoModeStore';
import { invalidateDemoCache } from '../../lib/demoData';
import type { DemoScenario } from '../../stores/demoModeStore';

const STORAGE_KEY = 'horizon-demo-tour-seen';

const scenarios: { key: DemoScenario; label: string; description: string; icon: typeof Shield; color: string; accent: string }[] = [
  {
    key: 'high-threat',
    label: 'High Threat',
    description: 'Active attack campaign with elevated traffic and critical alerts',
    icon: AlertTriangle,
    color: 'text-ac-red',
    accent: 'border-ac-red/40 hover:bg-ac-red/10',
  },
  {
    key: 'normal',
    label: 'Normal Operations',
    description: 'Steady-state fleet with moderate threat activity',
    icon: Shield,
    color: 'text-ac-green',
    accent: 'border-ac-green/40 hover:bg-ac-green/10',
  },
  {
    key: 'quiet',
    label: 'Quiet Period',
    description: 'Low traffic with minimal threat detections',
    icon: Moon,
    color: 'text-ac-cyan',
    accent: 'border-ac-cyan/40 hover:bg-ac-cyan/10',
  },
];

function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markTourSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable
  }
}

export function DemoTourModal() {
  const [open, setOpen] = useState(() => {
    if (import.meta.env.VITE_DEMO_MODE !== 'true') return false;
    return !hasSeenTour();
  });
  const { enableDemo, setScenario } = useDemoActions();
  const [selected, setSelected] = useState<DemoScenario>('high-threat');

  if (!open) return null;

  const handleStart = () => {
    invalidateDemoCache();
    enableDemo();
    setScenario(selected);
    markTourSeen();
    setOpen(false);
  };

  const handleDismiss = () => {
    markTourSeen();
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={handleDismiss} size="md">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <Stack direction="row" align="center" gap="sm" className="mb-3">
            <div className="w-8 h-8 bg-ac-magenta/15 border border-ac-magenta/30 flex items-center justify-center">
              <Play className="w-4 h-4 text-ac-magenta" />
            </div>
            <h2 className="text-lg font-light text-ink-primary tracking-wide">
              Welcome to Horizon
            </h2>
          </Stack>
          <p className="text-sm text-ink-secondary leading-relaxed">
            This is an interactive demo running with synthetic data.
            Explore threat intelligence, fleet operations, and campaign
            correlation — no backend required.
          </p>
        </div>

        {/* Scenario picker */}
        <div className="mb-6">
          <p className="text-[10px] tracking-[0.2em] uppercase text-ink-muted mb-3 font-medium">
            Choose a scenario
          </p>
          <div className="space-y-2">
            {scenarios.map((s) => {
              const isSelected = selected === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelected(s.key)}
                  className={clsx(
                    'w-full text-left px-4 py-3 border transition-colors',
                    isSelected
                      ? 'bg-surface-card border-ac-magenta'
                      : clsx('border-border-subtle', s.accent),
                  )}
                >
                  <Stack direction="row" align="start" gap="md">
                    <s.icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', s.color)} />
                    <div className="flex-1 min-w-0">
                      <Stack direction="row" align="center" gap="sm">
                        <span className="text-sm font-medium text-ink-primary">{s.label}</span>
                        {isSelected && (
                          <span className="text-[9px] tracking-wider uppercase text-ac-magenta font-medium">Selected</span>
                        )}
                      </Stack>
                      <p className="text-xs text-ink-muted mt-0.5">{s.description}</p>
                    </div>
                  </Stack>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hint */}
        <p className="text-xs text-ink-muted mb-5">
          You can switch scenarios anytime using the <strong className="text-ink-secondary">Demo Mode</strong> controls in the top header bar.
        </p>

        {/* Actions */}
        <Stack direction="row" align="center" justify="end" gap="sm">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="px-5 py-2 bg-ac-magenta text-white text-sm font-medium hover:bg-ac-magenta/90 transition-colors"
          >
            <Stack direction="row" align="center" gap="sm">
              <span>Start Exploring</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Stack>
          </button>
        </Stack>
      </div>
    </Modal>
  );
}
