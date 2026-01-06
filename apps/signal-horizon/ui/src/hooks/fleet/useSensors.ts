import { useQuery } from '@tanstack/react-query';
import type { SensorSummary } from '../../types/fleet';
import { useDemoMode } from '../../stores/demoModeStore';
import { getDemoData } from '../../lib/demoData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const API_KEY = import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

async function fetchSensors(): Promise<SensorSummary[]> {
  const response = await fetch(`${API_BASE}/api/v1/fleet/sensors`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch sensors');
  const data = await response.json();
  return data.sensors || data;
}

/**
 * Hook to fetch sensors from the API or return demo data when demo mode is enabled.
 */
export function useSensors() {
  const { isEnabled: isDemoMode, scenario } = useDemoMode();

  return useQuery({
    queryKey: ['fleet', 'sensors', isDemoMode ? scenario : 'live'],
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
