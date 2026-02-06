import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from 'pino';
import { SensorBridge } from './sensor-bridge.js';

const wsMock = vi.hoisted(() => {
  let lastArgs: unknown[] = [];

  class MockWebSocket {
    static OPEN = 1;
    readyState = 0;
    on = vi.fn();
    send = vi.fn();
    close = vi.fn();
  }

  const ctor = vi.fn((...args: unknown[]) => {
    lastArgs = args;
    return new MockWebSocket();
  }) as unknown as { new (...args: unknown[]): MockWebSocket; OPEN: number };

  ctor.OPEN = MockWebSocket.OPEN;

  return {
    ctor,
    getLastArgs: () => lastArgs,
    reset: () => {
      lastArgs = [];
      ctor.mockClear();
    },
  };
});

vi.mock('ws', () => ({
  default: wsMock.ctor,
}));

const createLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger);

describe('SensorBridge', () => {
  beforeEach(() => {
    wsMock.reset();
  });

  it('passes API key as Authorization header during WS upgrade', async () => {
    const bridge = new SensorBridge({
      hubWsUrl: 'ws://localhost:3100/ws/sensors',
      pingoraAdminUrl: 'http://localhost:6191',
      apiKey: 'bridge-api-key',
      sensorId: 'synapse-pingora-1',
      sensorName: 'Synapse Pingora',
    }, createLogger());

    await bridge.start();

    expect(wsMock.ctor).toHaveBeenCalledTimes(1);
    const lastArgs = wsMock.getLastArgs();
    expect(lastArgs[0]).toBe('ws://localhost:3100/ws/sensors');
    expect(lastArgs[1]).toMatchObject({
      headers: {
        Authorization: 'Bearer bridge-api-key',
      },
    });
  });

  it('logs status on unexpected response', async () => {
    const logger = createLogger();
    const bridge = new SensorBridge({
      hubWsUrl: 'ws://localhost:3100/ws/sensors',
      pingoraAdminUrl: 'http://localhost:6191',
      apiKey: 'bridge-api-key',
      sensorId: 'synapse-pingora-1',
      sensorName: 'Synapse Pingora',
    }, logger);

    await bridge.start();

    const wsInstance = wsMock.ctor.mock.results[0]?.value as { on: (event: string, cb: (...args: any[]) => void) => void };
    const onCalls = (wsInstance.on as ReturnType<typeof vi.fn>).mock.calls;
    const handler = onCalls.find(([event]) => event === 'unexpected-response')?.[1] as
      ((req: unknown, res: { statusCode?: number; statusMessage?: string; headers?: Record<string, string> }) => void) | undefined;

    expect(handler).toBeTypeOf('function');
    handler?.({}, { statusCode: 401, statusMessage: 'Unauthorized', headers: { foo: 'bar' } });

    expect(logger.error).toHaveBeenCalledWith(
      {
        statusCode: 401,
        statusMessage: 'Unauthorized',
        headers: { foo: 'bar' },
      },
      'WebSocket upgrade rejected'
    );
  });
});
