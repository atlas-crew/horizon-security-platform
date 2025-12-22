import { useQuery } from '@tanstack/react-query';
import type { SensorSummary } from '../../types/fleet';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3003';

async function fetchSensors(): Promise<SensorSummary[]> {
  const response = await fetch(`${API_BASE}/api/fleet/sensors`);
  if (!response.ok) throw new Error('Failed to fetch sensors');
  return response.json();
}

export function useSensors() {
  return useQuery({
    queryKey: ['fleet', 'sensors'],
    queryFn: fetchSensors,
    refetchInterval: 5000,
    staleTime: 4000,
  });
}
