import { useQuery } from '@tanstack/react-query';
import type { SensorSummary } from '../../types/fleet';
import { useDemoMode } from '../../stores/demoModeStore';
import { getDemoData } from '../../lib/demoData';
import { fleetKeys, getQueryMode } from '../../lib/queryKeys';
import { apiFetch } from '../../lib/api';

async function fetchSensors(): Promise<SensorSummary[]> {
  const data = await apiFetch<any>('/fleet/sensors');
  return data.sensors || data;
}

/**
 * Hook to fetch sensors from the API or return demo data when demo mode is enabled.
 */
export function useSensors() {
  const { isEnabled: isDemoMode, scenario } = useDemoMode();
  const mode = getQueryMode(isDemoMode, scenario);

  return useQuery({
    queryKey: fleetKeys.sensors(mode),
    queryFn: () => {
      // Return demo data when demo mode is enabled
      if (isDemoMode) {
        const demoData = getDemoData(scenario);
        return demoData.fleet.sensors as SensorSummary[];
      }
      return fetchSensors();
    },
    // Disable polling in demo mode (static snapshot)
    refetchInterval: isDemoMode ? false : 5000,
    staleTime: isDemoMode ? Infinity : 4000,
  });
}
