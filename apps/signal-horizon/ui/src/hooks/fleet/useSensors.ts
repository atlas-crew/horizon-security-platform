import { useQuery } from '@tanstack/react-query';
import type { SensorSummary } from '../../types/fleet';

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

export function useSensors() {
  return useQuery({
    queryKey: ['fleet', 'sensors'],
    queryFn: fetchSensors,
    refetchInterval: 5000,
    staleTime: 4000,
  });
}
