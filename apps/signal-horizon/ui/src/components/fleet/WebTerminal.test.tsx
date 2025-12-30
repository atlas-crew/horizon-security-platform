/**
 * WebTerminal Component Test Suite
 *
 * Tests for the xterm.js-based terminal component used
 * for remote shell sessions to sensors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock xterm before importing the component
vi.mock('@xterm/xterm', () => {
  const Terminal = vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn(),
    options: {},
    loadAddon: vi.fn(),
  }));
  return { Terminal };
});

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
}));

// Import component after mocks are set up
import { WebTerminal } from './WebTerminal';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 0);
  }
}

describe('WebTerminal', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
  });

  it('should render terminal header', () => {
    render(<WebTerminal sensorId="sensor-1" sessionId="session-1" />);

    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByText(/session-1/i)).toBeInTheDocument();
  });

  it('should show connecting state initially', () => {
    render(<WebTerminal sensorId="sensor-1" sessionId="session-1" />);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('should show connected state after WebSocket opens', async () => {
    render(<WebTerminal sensorId="sensor-1" sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('should call onConnect callback when connected', async () => {
    const onConnect = vi.fn();

    render(
      <WebTerminal sensorId="sensor-1" sessionId="session-1" onConnect={onConnect} />
    );

    await waitFor(() => {
      expect(onConnect).toHaveBeenCalled();
    });
  });

  it('should show error state when no sessionId provided', () => {
    render(<WebTerminal sensorId="sensor-1" />);

    // When no sessionId, the component shows error state
    expect(screen.getByText(/No session ID provided|Not connected/i)).toBeInTheDocument();
  });

  it('should render terminal container', () => {
    const { container } = render(
      <WebTerminal sensorId="sensor-1" sessionId="session-1" />
    );

    // Check for terminal container with xterm styles
    expect(container.querySelector('.flex.flex-col')).toBeInTheDocument();
  });

  it('should call onError when connection fails', async () => {
    const onError = vi.fn();

    // Override WebSocket to simulate error
    global.WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        setTimeout(() => {
          if (this.onerror) this.onerror();
        }, 0);
      }
    } as unknown as typeof WebSocket;

    render(
      <WebTerminal sensorId="sensor-1" sessionId="session-1" onError={onError} />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });
});
