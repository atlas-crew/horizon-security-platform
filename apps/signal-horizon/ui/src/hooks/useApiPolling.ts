/**
 * Reusable polling hook for Signal Horizon API endpoints
 * Provides request deduplication, error handling, and backpressure support
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../lib/api';

interface UseApiPollingOptions<T> {
  /** API endpoint path (e.g., '/beam/analytics') */
  endpoint: string;
  /** Initial/fallback data when API is unavailable */
  initialData: T;
  /** Polling interval in milliseconds (default: 30000) */
  pollInterval?: number;
  /** Enable/disable polling (default: true) */
  enabled?: boolean;
  /** Transform function for API response */
  transform?: (data: unknown) => T;
}

interface UseApiPollingResult<T> {
  /** Current data (from API or initialData fallback) */
  data: T;
  /** Whether a fetch is in progress */
  isLoading: boolean;
  /** Error message if last fetch failed */
  error: string | null;
  /** Whether displaying demo/fallback data due to API error */
  isDemo: boolean;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Timestamp of last successful fetch */
  lastUpdated: Date | null;
}

export function useApiPolling<T>({
  endpoint,
  initialData,
  pollInterval = 30000,
  enabled = true,
  transform,
}: UseApiPollingOptions<T>): UseApiPollingResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs for request deduplication and cleanup
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Prevent overlapping requests
    if (isFetchingRef.current || !enabled) return;

    // Cancel any pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const rawData = await apiFetch<unknown>(endpoint, {
        signal: abortControllerRef.current.signal,
      });

      const transformedData = transform ? transform(rawData) : (rawData as T);
      setData(transformedData);
      setError(null);
      setIsDemo(false);
      setLastUpdated(new Date());
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[useApiPolling] ${endpoint} failed:`, errorMessage);
      setError(errorMessage);
      setIsDemo(true);
      // Keep existing data or use initialData
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [endpoint, enabled, transform]);

  const refetch = useCallback(async () => {
    isFetchingRef.current = false; // Allow refetch even if one is "in progress"
    await fetchData();
  }, [fetchData]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchData();

    // Set up polling
    const intervalId = setInterval(fetchData, pollInterval);

    return () => {
      clearInterval(intervalId);
      abortControllerRef.current?.abort();
    };
  }, [enabled, pollInterval, fetchData]);

  return {
    data,
    isLoading,
    error,
    isDemo,
    refetch,
    lastUpdated,
  };
}
