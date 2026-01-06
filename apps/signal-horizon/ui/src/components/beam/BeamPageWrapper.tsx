import { ReactNode } from 'react';
import { useDemoMode, useDemoActions } from '../../stores/demoModeStore';
import { DemoModeBanner } from '../feedback/DemoModeBanner';

interface BeamPageWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper for Beam pages that displays the demo mode banner when active
 */
export function BeamPageWrapper({ children }: BeamPageWrapperProps) {
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

export default BeamPageWrapper;
