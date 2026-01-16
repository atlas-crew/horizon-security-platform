/**
 * useRemoteShell Hook
 * Manages WebSocket connection for remote shell sessions to sensors
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ShellSession,
  ShellSessionStatus,
  ShellMessage,
  ShellServerMessage,
  ShellInitOptions,
  ShellReconnectOptions,
} from '../../types/shell';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const API_KEY = import.meta.env.VITE_API_KEY || import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

/** Default reconnection options */
const DEFAULT_RECONNECT_OPTIONS: ShellReconnectOptions = {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

/** Maximum session duration warning threshold (25 minutes) */
const SESSION_WARNING_THRESHOLD = 25 * 60 * 1000;

/** Maximum session duration (30 minutes) */
const MAX_SESSION_DURATION = 30 * 60 * 1000;

export interface UseRemoteShellOptions {
  /** Target sensor ID */
  sensorId: string;
  /** Callback when data is received from the shell */
  onData: (data: string) => void;
  /** Callback when shell session exits */
  onExit?: (code: number) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Callback when session is about to timeout */
  onTimeoutWarning?: (remainingMs: number) => void;
  /** Callback when session is ready */
  onReady?: () => void;
  /** Custom reconnection options */
  reconnectOptions?: Partial<ShellReconnectOptions>;
  /** Auto-connect on mount */
  autoConnect?: boolean;
}

export interface UseRemoteShellReturn {
  /** Current connection status */
  status: ShellSessionStatus;
  /** Connect to the shell */
  connect: (options?: ShellInitOptions) => void;
  /** Disconnect from the shell */
  disconnect: () => void;
  /** Send input to the shell */
  sendInput: (data: string) => void;
  /** Resize the terminal */
  resize: (cols: number, rows: number) => void;
  /** Current session information */
  session: ShellSession | null;
  /** Whether reconnection is in progress */
  isReconnecting: boolean;
  /** Current reconnection attempt number */
  reconnectAttempt: number;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook for managing remote shell WebSocket connections
 */
export function useRemoteShell(options: UseRemoteShellOptions): UseRemoteShellReturn {
  const {
    sensorId,
    onData,
    onExit,
    onError,
    onTimeoutWarning,
    onReady,
    reconnectOptions = {},
    autoConnect = false,
  } = options;

  const reconnectConfig: ShellReconnectOptions = {
    ...DEFAULT_RECONNECT_OPTIONS,
    ...reconnectOptions,
  };

  // State
  const [status, setStatus] = useState<ShellSessionStatus>('disconnected');
  const [session, setSession] = useState<ShellSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<Date | null>(null);
  const timeoutWarningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCleaningUpRef = useRef(false);
  const pendingInitOptionsRef = useRef<ShellInitOptions | null>(null);

  /**
   * Clear all timers
   */
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (timeoutWarningRef.current) {
      clearTimeout(timeoutWarningRef.current);
      timeoutWarningRef.current = null;
    }
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
  }, []);

  /**
   * Clean up WebSocket connection and timers
   */
  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close(1000, 'Cleanup');
      wsRef.current = null;
    }

    isCleaningUpRef.current = false;
  }, [clearTimers]);

  /**
   * Setup session timeout warnings
   */
  const setupSessionTimeouts = useCallback(() => {
    clearTimers();
    sessionStartRef.current = new Date();

    // Warning at 25 minutes
    timeoutWarningRef.current = setTimeout(() => {
      const remaining = MAX_SESSION_DURATION - SESSION_WARNING_THRESHOLD;
      onTimeoutWarning?.(remaining);
    }, SESSION_WARNING_THRESHOLD);

    // Force disconnect at 30 minutes
    sessionTimeoutRef.current = setTimeout(() => {
      setError('Session timeout - maximum duration reached');
      setStatus('error');
      cleanup();
      onError?.('Session timeout - maximum duration reached');
    }, MAX_SESSION_DURATION);
  }, [cleanup, clearTimers, onError, onTimeoutWarning]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: ShellServerMessage = JSON.parse(event.data as string);

        switch (message.type) {
          case 'shell-data':
            if (message.payload?.data) {
              // Data comes base64 encoded from the server
              onData(message.payload.data);
            }
            break;

          case 'shell-ready':
            setStatus('connected');
            setReconnectAttempt(0);
            setIsReconnecting(false);
            setupSessionTimeouts();
            onReady?.();
            break;

          case 'shell-exit':
            setStatus('disconnected');
            cleanup();
            onExit?.(message.payload?.code ?? 0);
            break;

          case 'shell-error':
            const errorMsg = message.payload?.error || 'Unknown shell error';
            setError(errorMsg);
            setStatus('error');
            onError?.(errorMsg);
            break;

          case 'pong':
            // Heartbeat response - connection is alive
            break;

          default:
            console.log('[RemoteShell] Unknown message type:', message.type);
        }
      } catch (err) {
        // If parsing fails, treat as raw data
        if (typeof event.data === 'string') {
          onData(event.data);
        }
      }
    },
    [cleanup, onData, onError, onExit, onReady, setupSessionTimeouts]
  );

  /**
   * Schedule a reconnection attempt
   */
  const scheduleReconnect = useCallback(() => {
    if (isCleaningUpRef.current) return;

    const nextAttempt = reconnectAttempt + 1;
    if (nextAttempt > reconnectConfig.maxAttempts) {
      setError('Max reconnection attempts reached');
      setStatus('error');
      setIsReconnecting(false);
      onError?.('Max reconnection attempts reached');
      return;
    }

    setIsReconnecting(true);
    setReconnectAttempt(nextAttempt);

    const delay = Math.min(
      reconnectConfig.baseDelay * Math.pow(2, nextAttempt - 1),
      reconnectConfig.maxDelay
    );

    console.log(`[RemoteShell] Reconnecting in ${delay}ms (attempt ${nextAttempt})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isCleaningUpRef.current) {
        // Reconnect with the same init options
        connectInternal(pendingInitOptionsRef.current || undefined);
      }
    }, delay);
  }, [reconnectAttempt, reconnectConfig, onError]);

  /**
   * Internal connect function
   */
  const connectInternal = useCallback(
    (initOptions?: ShellInitOptions) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      cleanup();
      setStatus('connecting');
      setError(null);

      // Store init options for potential reconnection
      if (initOptions) {
        pendingInitOptionsRef.current = initOptions;
      }

      // Build WebSocket URL
      const wsProtocol = API_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/v1/tunnel?channel=shell&sensorId=${sensorId}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[RemoteShell] WebSocket connected');

          // Generate session ID
          const sessionId = `shell-${sensorId}-${Date.now()}`;

          // Create session object
          const newSession: ShellSession = {
            id: sessionId,
            sensorId,
            status: 'connecting',
            startedAt: new Date(),
          };
          setSession(newSession);

          // Send authentication
          ws.send(
            JSON.stringify({
              type: 'auth',
              payload: { apiKey: API_KEY },
            })
          );

          // Send shell init message
          ws.send(
            JSON.stringify({
              type: 'shell-init',
              sessionId,
              sensorId,
              options: initOptions || { cols: 80, rows: 24 },
            })
          );
        };

        ws.onmessage = handleMessage;

        ws.onerror = (event) => {
          console.error('[RemoteShell] WebSocket error:', event);
          const errorMsg = 'WebSocket connection error';
          setError(errorMsg);
          setStatus('error');
          onError?.(errorMsg);
        };

        ws.onclose = (event) => {
          console.log('[RemoteShell] WebSocket closed:', event.code, event.reason);
          wsRef.current = null;

          if (!isCleaningUpRef.current) {
            setStatus('disconnected');

            // Attempt reconnection unless it was a clean close
            if (event.code !== 1000 && event.code !== 1001) {
              scheduleReconnect();
            }
          }
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create WebSocket';
        setError(errorMsg);
        setStatus('error');
        onError?.(errorMsg);
      }
    },
    [cleanup, handleMessage, onError, scheduleReconnect, sensorId]
  );

  /**
   * Connect to the remote shell
   */
  const connect = useCallback(
    (initOptions?: ShellInitOptions) => {
      setReconnectAttempt(0);
      setIsReconnecting(false);
      connectInternal(initOptions);
    },
    [connectInternal]
  );

  /**
   * Disconnect from the remote shell
   */
  const disconnect = useCallback(() => {
    isCleaningUpRef.current = true;
    clearTimers();
    setReconnectAttempt(0);
    setIsReconnecting(false);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Send disconnect message before closing
      wsRef.current.send(
        JSON.stringify({
          type: 'shell-disconnect',
          sessionId: session?.id,
        })
      );
    }

    cleanup();
    setStatus('disconnected');
    setSession(null);
    setError(null);
    pendingInitOptionsRef.current = null;
    isCleaningUpRef.current = false;
  }, [cleanup, clearTimers, session?.id]);

  /**
   * Send input to the shell (base64 encoded)
   */
  const sendInput = useCallback(
    (data: string) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        console.warn('[RemoteShell] Cannot send - not connected');
        return;
      }

      const message: ShellMessage = {
        type: 'data',
        sessionId: session?.id || '',
        data, // Already base64 encoded by caller
      };

      wsRef.current.send(JSON.stringify(message));
    },
    [session?.id]
  );

  /**
   * Send terminal resize event
   */
  const resize = useCallback(
    (cols: number, rows: number) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }

      const message: ShellMessage = {
        type: 'resize',
        sessionId: session?.id || '',
        cols,
        rows,
      };

      wsRef.current.send(JSON.stringify(message));
    },
    [session?.id]
  );

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
  }, [autoConnect, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    connect,
    disconnect,
    sendInput,
    resize,
    session,
    isReconnecting,
    reconnectAttempt,
    error,
  };
}
