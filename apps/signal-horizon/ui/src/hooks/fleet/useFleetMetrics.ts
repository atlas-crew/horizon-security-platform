import { useQuery } from '@tanstack/react-query';
import type { FleetMetrics } from '../../types/fleet';
import { useDemoMode } from '../../stores/demoModeStore';
import { getDemoData } from '../../lib/demoData';
import { fleetKeys, getQueryMode } from '../../lib/queryKeys';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const API_KEY = import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

async function fetchFleetMetrics(): Promise<FleetMetrics> {
  const response = await fetch(`${API_BASE}/api/v1/fleet/metrics`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!response.ok) throw new Error('Failed to fetch fleet metrics');
  return response.json();
}

/**
 * Hook to fetch fleet metrics from the API or return demo data when demo mode is enabled.
 */
export function useFleetMetrics() {
  const { isEnabled: isDemoMode, scenario } = useDemoMode();
  const mode = getQueryMode(isDemoMode, scenario);

  return useQuery({
    queryKey: fleetKeys.metrics(mode),
    queryFn: () => {
      // Return demo data when demo mode is enabled
      if (isDemoMode) {
        const demoData = getDemoData(scenario);
        return demoData.fleet.metrics as FleetMetrics;
      }
      return fetchFleetMetrics();
    },
    // Disable polling in demo mode (static snapshot)
    refetchInterval: isDemoMode ? false : 5000,
    staleTime: isDemoMode ? Infinity : 4000,
  });
}
