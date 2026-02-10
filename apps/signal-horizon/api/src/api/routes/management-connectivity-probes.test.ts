import { describe, it, expect } from 'vitest';
import http from 'http';
import net from 'net';
import dgram from 'dgram';

import { runConnectivityTest } from './management.js';

const logger = {
  warn: () => undefined,
  info: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as any;

function listenHttpServer(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') return reject(new Error('no address'));
      resolve({ server, port: addr.port });
    });
  });
}

function listenTcpServer(onConn: (socket: net.Socket) => void): Promise<{ server: net.Server; port: number }> {
  const server = net.createServer(onConn);
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') return reject(new Error('no address'));
      resolve({ server, port: addr.port });
    });
  });
}

function listenUdpEchoServer(): Promise<{ server: dgram.Socket; port: number }> {
  const server = dgram.createSocket('udp4');
  server.on('message', (msg, rinfo) => {
    server.send(msg, rinfo.port, rinfo.address);
  });
  return new Promise((resolve, reject) => {
    server.bind(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') return reject(new Error('no address'));
      resolve({ server, port: addr.port });
    });
  });
}

function closeServer(server: { close: (cb?: (err?: any) => void) => void }): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('runConnectivityTest protocol probes (localhost)', () => {
  it('http1: returns passed with statusCode', async () => {
    const { server, port } = await listenHttpServer((req, res) => {
      if (req.url?.startsWith('/echo')) {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('ok');
        return;
      }
      res.writeHead(404);
      res.end('no');
    });

    try {
      const result = await runConnectivityTest('http1', `http://127.0.0.1:${port}/echo`, logger, { allowPrivate: true });
      expect(result.status).toBe('passed');
      expect((result.details as any).statusCode).toBe(200);
    } finally {
      await closeServer(server);
    }
  });

  it('tcp: echoes payload', async () => {
    const { server, port } = await listenTcpServer((socket) => socket.pipe(socket));
    try {
      const result = await runConnectivityTest('tcp', `127.0.0.1:${port}`, logger, { allowPrivate: true });
      expect(result.status).toBe('passed');
      expect((result.details as any).echoed).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  it('udp: echoes payload', async () => {
    const { server, port } = await listenUdpEchoServer();
    try {
      const result = await runConnectivityTest('udp', `127.0.0.1:${port}`, logger, { allowPrivate: true });
      expect(result.status).toBe('passed');
      expect((result.details as any).echoed).toBe(true);
    } finally {
      server.close();
    }
  });

  it('grpc: detects http2 settings frame', async () => {
    const settingsFrame = Buffer.from([0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const { server, port } = await listenTcpServer((socket) => {
      socket.on('data', () => socket.write(settingsFrame));
    });
    try {
      const result = await runConnectivityTest('grpc', `127.0.0.1:${port}`, logger, { allowPrivate: true });
      expect(result.status).toBe('passed');
      expect((result.details as any).http2SettingsFrame).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  it('mqtt: validates CONNACK', async () => {
    const connack = Buffer.from([0x20, 0x02, 0x00, 0x00]);
    const { server, port } = await listenTcpServer((socket) => {
      socket.on('data', () => socket.write(connack));
    });
    try {
      const result = await runConnectivityTest('mqtt', `127.0.0.1:${port}`, logger, { allowPrivate: true });
      expect(result.status).toBe('passed');
      expect((result.details as any).connack).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  it('redis: parses +PONG', async () => {
    const { server, port } = await listenTcpServer((socket) => {
      socket.on('data', () => socket.write('+PONG\r\n'));
    });
    try {
      const result = await runConnectivityTest('redis', `127.0.0.1:${port}`, logger, { allowPrivate: true });
      expect(result.status).toBe('passed');
      expect((result.details as any).pong).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  it('smtp: banner + EHLO', async () => {
    const { server, port } = await listenTcpServer((socket) => {
      socket.write('220 test-smtp ESMTP\r\n');
      socket.on('data', (chunk) => {
        const s = chunk.toString().toUpperCase();
        if (s.includes('EHLO')) {
          socket.write('250-test-smtp\r\n250 PIPELINING\r\n');
        }
      });
    });
    try {
      const result = await runConnectivityTest('smtp', `127.0.0.1:${port}`, logger, { allowPrivate: true });
      expect(result.status).toBe('passed');
      expect((result.details as any).greeted).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  it('icap: OPTIONS returns 200/204', async () => {
    const { server, port } = await listenTcpServer((socket) => {
      socket.on('data', () => socket.write('ICAP/1.0 200 OK\r\n\r\n'));
    });
    try {
      const result = await runConnectivityTest('icap', `127.0.0.1:${port}`, logger, { allowPrivate: true });
      expect(result.status).toBe('passed');
      expect((result.details as any).ok).toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  it('syslog: send completes without error', async () => {
    const server = dgram.createSocket('udp4');
    await new Promise<void>((resolve) => server.bind(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no address');

    try {
      const result = await runConnectivityTest('syslog', `127.0.0.1:${addr.port}`, logger, { allowPrivate: true });
      expect(result.status).toBe('passed');
    } finally {
      server.close();
    }
  });
});

