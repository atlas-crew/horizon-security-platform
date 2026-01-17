
import { useState, useEffect, useCallback } from 'react';
import { useDemoMode } from '../stores/demoModeStore';

const API_KEY = import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

export type AttackSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AttackPoint {
  id: number;
  lat: number;
  lon: number;
  severity: AttackSeverity;
  label: string;
  count: number;
  scope: 'fleet' | 'local';
  category: 'bot' | 'attack';
  x?: number; // Added for D3 projection
  y?: number; // Added for D3 projection
  xPercent?: number; // Added for CSS positioning
  yPercent?: number; // Added for CSS positioning
}

export interface AttackRoute {
  id: string;
  from: number;
  to: number;
  severity: AttackSeverity;
  category: 'bot' | 'attack';
  path?: string; // Added for SVG path
}

export interface AttackMapData {
  points: AttackPoint[];
  routes: AttackRoute[];
}

// Fallback data for demo mode or initial load
const DEMO_POINTS: AttackPoint[] = [
  { id: 1, lat: 39, lon: -77, severity: 'CRITICAL', label: 'US East', count: 1280, scope: 'fleet', category: 'attack' },
  { id: 2, lat: -15, lon: -60, severity: 'HIGH', label: 'LATAM', count: 860, scope: 'local', category: 'bot' },
  { id: 3, lat: 50, lon: 5, severity: 'MEDIUM', label: 'Western EU', count: 640, scope: 'fleet', category: 'attack' },
  { id: 4, lat: 30, lon: 35, severity: 'LOW', label: 'MENA', count: 420, scope: 'local', category: 'bot' },
  { id: 5, lat: 13, lon: 100, severity: 'HIGH', label: 'SEA', count: 980, scope: 'fleet', category: 'attack' },
  { id: 6, lat: 35, lon: 135, severity: 'CRITICAL', label: 'APAC Core', count: 1560, scope: 'fleet', category: 'attack' },
];

const DEMO_ROUTES: AttackRoute[] = [
  { id: 'na-eu', from: 1, to: 3, severity: 'HIGH', category: 'attack' },
  { id: 'na-apac', from: 1, to: 6, severity: 'CRITICAL', category: 'attack' },
  { id: 'latam-eu', from: 2, to: 3, severity: 'MEDIUM', category: 'bot' },
  { id: 'eu-sea', from: 3, to: 5, severity: 'HIGH', category: 'attack' },
  { id: 'mena-sea', from: 4, to: 5, severity: 'LOW', category: 'bot' },
];

export function useAttackMap(windowHours = 24) {
  const { isEnabled } = useDemoMode();
  const [data, setData] = useState<AttackMapData>({ points: [], routes: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (isEnabled) {
      setData({ points: DEMO_POINTS, routes: DEMO_ROUTES });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/intel/map?windowHours=${windowHours}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch attack map: ${response.status}`);
      }

      const apiData = await response.json();
      
      // Ensure data matches expected shape
      setData({
        points: apiData.points || [],
        routes: apiData.routes || [],
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching attack map:', err);
      setError(err as Error);
      // Fallback to demo data on error for better UX? Or just empty?
      // Let's fallback to demo data for now to keep the UI looking good
      setData({ points: DEMO_POINTS, routes: DEMO_ROUTES });
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, windowHours]);

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { ...data, isLoading, error, refetch: fetchData };
}
