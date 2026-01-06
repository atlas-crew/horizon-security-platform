import { ReactNode } from 'react';
import { useDemoMode, useDemoActions } from '../../stores/demoModeStore';
import { DemoModeBanner } from '../feedback/DemoModeBanner';

interface SignalHorizonPageWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper for Signal Horizon pages that displays the demo mode banner when active
 */
export function SignalHorizonPageWrapper({ children }: SignalHorizonPageWrapperProps) {
  const { isEnabled, scenario } = useDemoMode();
  const { disableDemo } = useDemoActions();

  return (
    <>
      {isEnabled && (
        <div className="px-6 pt-4">
          <DemoModeBanner
            scenario={scenario}
            variant="demo"
            onRetry={disableDemo}
            dismissible
          />
        </div>
      )}
      {children}
    </>
  );
}

export default SignalHorizonPageWrapper;
