/**
 * Shared API utilities for Signal Horizon UI
 * Provides centralized API configuration and authenticated fetch
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100/api/v1';
export const API_KEY = import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

interface FetchOptions {
  signal?: AbortSignal;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

/**
 * Authenticated fetch wrapper for Signal Horizon API
 * Automatically adds Authorization header and handles JSON responses
 */
export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { signal, method = 'GET', body } = options;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    signal,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
