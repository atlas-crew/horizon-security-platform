import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import { invalidateDemoCache } from '../lib/demoData';

// Demo scenario types
export type DemoScenario = 'high-threat' | 'normal' | 'quiet';

/** Pages that should be hidden from the sidebar in demo mode */
export const DEMO_HIDDEN_PATHS = new Set([
  '/settings/admin',
  '/fleet/keys',
  '/fleet/onboarding',
]);

interface DemoModeState {
  // State
  isEnabled: boolean;
  scenario: DemoScenario;
  tick: number;

  // Actions
  toggleDemo: () => void;
  enableDemo: () => void;
  disableDemo: () => void;
  setScenario: (scenario: DemoScenario) => void;
  bumpTick: () => void;
}

export const useDemoModeStore = create<DemoModeState>()(
  persist(
    (set) => ({
      // Initial state — VITE_DEMO_MODE=true activates demo mode by default
      isEnabled: import.meta.env.VITE_DEMO_MODE === 'true',
      scenario: 'normal',
      tick: 0,

      // Actions
      toggleDemo: () =>
        set((state) => ({ isEnabled: !state.isEnabled })),

      enableDemo: () =>
        set({ isEnabled: true }),

      disableDemo: () =>
        set({ isEnabled: false }),

      setScenario: (scenario) =>
        set({ scenario }),

      bumpTick: () =>
        set((state) => ({ tick: state.tick + 1 })),
    }),
    {
      name: 'beam-demo-mode',
      // tick is NOT persisted — always starts at 0
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        scenario: state.scenario,
      }),
    }
  )
);

// Memoized selectors
export const useDemoMode = () =>
  useDemoModeStore(
    useShallow((state) => ({
      isEnabled: state.isEnabled,
      scenario: state.scenario,
      tick: state.tick,
    }))
  );

export const useDemoActions = () =>
  useDemoModeStore(
    useShallow((state) => ({
      toggleDemo: state.toggleDemo,
      enableDemo: state.enableDemo,
      disableDemo: state.disableDemo,
      setScenario: state.setScenario,
    }))
  );

// Convenience hook for checking if demo mode is active
export const useIsDemo = () => useDemoModeStore((state) => state.isEnabled);

// Get current scenario
export const useDemoScenario = () => useDemoModeStore((state) => state.scenario);

/**
 * Hook that drives simulated real-time updates in demo mode.
 * Invalidates the demo data cache and bumps a tick counter on an interval,
 * causing hooks that read demo data to re-render with fresh generated values.
 *
 * Mount once in the app shell (e.g., App.tsx).
 */
export function useDemoLiveUpdates(intervalMs = 8000) {
  const isEnabled = useIsDemo();
  const bumpTick = useDemoModeStore((s) => s.bumpTick);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      invalidateDemoCache();
      bumpTick();
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isEnabled, intervalMs, bumpTick]);
}
