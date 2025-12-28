import { useQuery } from '@tanstack/react-query';
import type { FleetMetrics } from '../../types/fleet';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const API_KEY = import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

async function fetchFleetMetrics(): Promise<FleetMetrics> {
  const response = await fetch(`${API_BASE}/api/v1/fleet/metrics`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!response.ok) throw new Error('Failed to fetch fleet metrics');
  return response.json();
}

export function useFleetMetrics() {
  return useQuery({
    queryKey: ['fleet', 'metrics'],
    queryFn: fetchFleetMetrics,
    refetchInterval: 5000,
    staleTime: 4000,
  });
}
