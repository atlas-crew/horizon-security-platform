import express from 'express';
import net from 'node:net';

const originalListen = express.application.listen;

const patchedExpressListen = function (this: express.Application, ...args: unknown[]): unknown {
  if (args.length === 0) {
    return (originalListen as any).apply(this, args);
  }

  const [port, hostOrBacklog, ...rest] = args;

  if (typeof hostOrBacklog === 'string') {
    return (originalListen as any).call(this, port, hostOrBacklog, ...rest);
  }

  if (typeof hostOrBacklog === 'number') {
    return (originalListen as any).call(this, port, '127.0.0.1', hostOrBacklog, ...rest);
  }

  if (typeof hostOrBacklog === 'function' || hostOrBacklog === undefined) {
    return (originalListen as any).call(this, port, '127.0.0.1', hostOrBacklog, ...rest);
  }

  return (originalListen as any).apply(this, args);
};

express.application.listen = patchedExpressListen as any;

const originalServerListen = net.Server.prototype.listen;

const patchedServerListen = function (this: net.Server, ...args: unknown[]): unknown {
  if (typeof args[0] === 'number') {
    const port = args[0];
    const hostOrBacklog = args[1];

    if (typeof hostOrBacklog === 'string') {
      const host = hostOrBacklog === '0.0.0.0' ? '127.0.0.1' : hostOrBacklog;
      return (originalServerListen as any).call(this, port, host, ...args.slice(2));
    }

    if (typeof hostOrBacklog === 'number') {
      return (originalServerListen as any).call(this, port, '127.0.0.1', hostOrBacklog, ...args.slice(2));
    }

    if (typeof hostOrBacklog === 'function' || hostOrBacklog === undefined) {
      return (originalServerListen as any).call(this, port, '127.0.0.1', hostOrBacklog, ...args.slice(2));
    }
  }

  return (originalServerListen as any).apply(this, args);
};

net.Server.prototype.listen = patchedServerListen as any;
