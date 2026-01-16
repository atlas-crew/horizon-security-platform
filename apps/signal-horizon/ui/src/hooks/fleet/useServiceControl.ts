/**
 * useServiceControl Hook
 * Manages service control commands for remote sensors (reload, restart, shutdown, drain, resume)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const API_KEY = import.meta.env.VITE_API_KEY || import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

/** Available control commands */
export type ControlCommand = 'reload' | 'restart' | 'shutdown' | 'drain' | 'resume';

/** Service operational states */
export type ServiceState = 'running' | 'draining' | 'restarting' | 'shutting_down';

/** Result of a control command execution */
export interface ControlResult {
  command: ControlCommand;
  success: boolean;
  message: string;
  state: ServiceState;
  timestamp: Date;
}

/** Service status from API */
export interface ServiceStatus {
  state: ServiceState;
  activeConnections: number;
  uptime: number;
  lastConfigReload: Date | null;
}

/** Options for the useServiceControl hook */
export interface UseServiceControlOptions {
  /** Target sensor ID */
  sensorId: string;
  /** Callback when service state changes */
  onStateChange?: (state: ServiceState) => void;
  /** Callback when command completes */
  onCommandComplete?: (result: ControlResult) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Auto-refresh status interval in ms (0 to disable) */
  refreshInterval?: number;
}

/** Return type for the useServiceControl hook */
export interface UseServiceControlReturn {
  /** Current service state */
  state: ServiceState;
  /** Number of active connections */
  activeConnections: number;
  /** Uptime in seconds */
  uptime: number;
  /** Whether a command is currently executing */
  isExecuting: boolean;
  /** Which command is currently executing */
  executingCommand: ControlCommand | null;
  /** Last command result */
  lastResult: ControlResult | null;
  /** Current error if any */
  error: Error | null;
  /** Whether status is loading */
  isLoading: boolean;
  /** Last time config was reloaded */
  lastConfigReload: Date | null;

  // Command methods
  /** Reload configuration without restart */
  reload: () => Promise<ControlResult>;
  /** Graceful restart (requires confirmation) */
  restart: (confirmed: boolean) => Promise<ControlResult>;
  /** Shutdown service (requires confirmation) */
  shutdown: (confirmed: boolean) => Promise<ControlResult>;
  /** Start draining connections */
  drain: () => Promise<ControlResult>;
  /** Resume accepting connections */
  resume: () => Promise<ControlResult>;

  // Utility methods
  /** Manually refresh status */
  refreshState: () => Promise<void>;
  /** Clear current error */
  clearError: () => void;
}

/**
 * Build authorization headers for API requests
 */
function getAuthHeaders(): HeadersInit {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Execute a control command against the API
 */
async function executeCommand(
  sensorId: string,
  command: ControlCommand,
  options?: Record<string, unknown>
): Promise<ControlResult> {
  const response = await fetch(
    `${API_URL}/api/v1/fleet/sensors/${sensorId}/control`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ command, options }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error || `Command failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const data = await response.json();

  return {
    command,
    success: data.success ?? true,
    message: data.message || `${command} command executed successfully`,
    state: data.state || 'running',
    timestamp: new Date(),
  };
}

/**
 * Fetch current service status from the API
 */
async function fetchServiceStatus(sensorId: string): Promise<ServiceStatus> {
  const response = await fetch(
    `${API_URL}/api/v1/fleet/sensors/${sensorId}/status`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch service status: ${response.status}`);
  }

  const data = await response.json();

  return {
    state: data.state || 'running',
    activeConnections: data.activeConnections ?? 0,
    uptime: data.uptime ?? 0,
    lastConfigReload: data.lastConfigReload ? new Date(data.lastConfigReload) : null,
  };
}

/**
 * Hook for managing service control commands for remote sensors
 */
export function useServiceControl(options: UseServiceControlOptions): UseServiceControlReturn {
  const {
    sensorId,
    onStateChange,
    onCommandComplete,
    onError,
    refreshInterval = 5000,
  } = options;

  // State
  const [state, setState] = useState<ServiceState>('running');
  const [activeConnections, setActiveConnections] = useState(0);
  const [uptime, setUptime] = useState(0);
  const [lastConfigReload, setLastConfigReload] = useState<Date | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingCommand, setExecutingCommand] = useState<ControlCommand | null>(null);
  const [lastResult, setLastResult] = useState<ControlResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refs
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const previousStateRef = useRef<ServiceState>(state);

  /**
   * Refresh service status from API
   */
  const refreshState = useCallback(async () => {
    try {
      const status = await fetchServiceStatus(sensorId);

      if (!isMountedRef.current) return;

      setState(status.state);
      setActiveConnections(status.activeConnections);
      setUptime(status.uptime);
      setLastConfigReload(status.lastConfigReload);
      setIsLoading(false);

      // Notify on state change
      if (status.state !== previousStateRef.current) {
        previousStateRef.current = status.state;
        onStateChange?.(status.state);
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const fetchError = err instanceof Error ? err : new Error('Failed to fetch status');
      setError(fetchError);
      setIsLoading(false);
      onError?.(fetchError);
    }
  }, [sensorId, onStateChange, onError]);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Execute a command with proper state management
   */
  const executeWithState = useCallback(
    async (command: ControlCommand, requiresConfirmation: boolean, confirmed?: boolean): Promise<ControlResult> => {
      // Check confirmation for destructive commands
      if (requiresConfirmation && !confirmed) {
        const rejectedResult: ControlResult = {
          command,
          success: false,
          message: `${command} requires confirmation`,
          state,
          timestamp: new Date(),
        };
        setLastResult(rejectedResult);
        return rejectedResult;
      }

      setIsExecuting(true);
      setExecutingCommand(command);
      setError(null);

      try {
        const result = await executeCommand(sensorId, command);

        if (!isMountedRef.current) return result;

        setLastResult(result);

        // Update state if returned
        if (result.state !== state) {
          setState(result.state);
          previousStateRef.current = result.state;
          onStateChange?.(result.state);
        }

        onCommandComplete?.(result);

        // Refresh status after command
        setTimeout(() => {
          if (isMountedRef.current) {
            refreshState();
          }
        }, 500);

        return result;
      } catch (err) {
        if (!isMountedRef.current) throw err;

        const commandError = err instanceof Error ? err : new Error(`${command} failed`);
        setError(commandError);
        onError?.(commandError);

        const failedResult: ControlResult = {
          command,
          success: false,
          message: commandError.message,
          state,
          timestamp: new Date(),
        };
        setLastResult(failedResult);
        onCommandComplete?.(failedResult);

        return failedResult;
      } finally {
        if (isMountedRef.current) {
          setIsExecuting(false);
          setExecutingCommand(null);
        }
      }
    },
    [sensorId, state, onStateChange, onCommandComplete, onError, refreshState]
  );

  /**
   * Reload configuration without restart
   */
  const reload = useCallback(async (): Promise<ControlResult> => {
    return executeWithState('reload', false);
  }, [executeWithState]);

  /**
   * Graceful restart (requires confirmation)
   */
  const restart = useCallback(
    async (confirmed: boolean): Promise<ControlResult> => {
      return executeWithState('restart', true, confirmed);
    },
    [executeWithState]
  );

  /**
   * Shutdown service (requires confirmation)
   */
  const shutdown = useCallback(
    async (confirmed: boolean): Promise<ControlResult> => {
      return executeWithState('shutdown', true, confirmed);
    },
    [executeWithState]
  );

  /**
   * Start draining connections
   */
  const drain = useCallback(async (): Promise<ControlResult> => {
    return executeWithState('drain', false);
  }, [executeWithState]);

  /**
   * Resume accepting connections
   */
  const resume = useCallback(async (): Promise<ControlResult> => {
    return executeWithState('resume', false);
  }, [executeWithState]);

  // Initial status fetch and refresh interval setup
  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    refreshState();

    // Setup refresh interval if enabled
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(refreshState, refreshInterval);
    }

    return () => {
      isMountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [refreshInterval, refreshState]);

  // Reset state when sensorId changes
  useEffect(() => {
    setState('running');
    setActiveConnections(0);
    setUptime(0);
    setLastConfigReload(null);
    setIsExecuting(false);
    setExecutingCommand(null);
    setLastResult(null);
    setError(null);
    setIsLoading(true);
    previousStateRef.current = 'running';

    // Fetch new sensor status
    refreshState();
  }, [sensorId, refreshState]);

  return {
    state,
    activeConnections,
    uptime,
    isExecuting,
    executingCommand,
    lastResult,
    error,
    isLoading,
    lastConfigReload,

    // Commands
    reload,
    restart,
    shutdown,
    drain,
    resume,

    // Utilities
    refreshState,
    clearError,
  };
}
