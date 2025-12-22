import { RouteObject } from 'react-router-dom';
import { FleetErrorBoundary } from '../components/fleet/FleetErrorBoundary';
import { FleetOverviewPage } from '../pages/fleet/FleetOverviewPage';
import { FleetHealthPage } from '../pages/fleet/FleetHealthPage';
import { FleetUpdatesPage } from '../pages/fleet/FleetUpdatesPage';
import { RuleDistributionPage } from '../pages/fleet/RuleDistributionPage';

/**
 * Fleet Management Routes
 * All fleet routes are wrapped with FleetErrorBoundary for error isolation
 * This ensures that failures in one fleet page don't crash the entire application
 */
export const fleetRoutes: RouteObject[] = [
  {
    path: '/fleet',
    element: (
      <FleetErrorBoundary level="page" title="Fleet Overview Error">
        <FleetOverviewPage />
      </FleetErrorBoundary>
    ),
  },
  {
    path: '/fleet/health',
    element: (
      <FleetErrorBoundary level="page" title="Fleet Health Error">
        <FleetHealthPage />
      </FleetErrorBoundary>
    ),
  },
  {
    path: '/fleet/updates',
    element: (
      <FleetErrorBoundary level="page" title="Fleet Updates Error">
        <FleetUpdatesPage />
      </FleetErrorBoundary>
    ),
  },
  {
    path: '/fleet/rules',
    element: (
      <FleetErrorBoundary level="page" title="Rule Distribution Error">
        <RuleDistributionPage />
      </FleetErrorBoundary>
    ),
  },
];
