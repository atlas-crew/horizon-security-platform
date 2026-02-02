import express from 'express';
import net from 'node:net';

const originalListen = express.application.listen;

express.application.listen = function (...args: Parameters<typeof originalListen>) {
  if (args.length === 0) {
    return originalListen.apply(this, args);
  }

  const [port, hostOrBacklog, ...rest] = args;

  if (typeof hostOrBacklog === 'string') {
    return originalListen.call(this, port, hostOrBacklog, ...rest);
  }

  if (typeof hostOrBacklog === 'number') {
    return originalListen.call(this, port, '127.0.0.1', hostOrBacklog, ...rest);
  }

  if (typeof hostOrBacklog === 'function' || hostOrBacklog === undefined) {
    return originalListen.call(this, port, '127.0.0.1', hostOrBacklog as any, ...rest);
  }

  return originalListen.apply(this, args);
};

const originalServerListen = net.Server.prototype.listen;

net.Server.prototype.listen = function (...args: Parameters<typeof originalServerListen>) {
  if (typeof args[0] === 'number') {
    const port = args[0];
    const hostOrBacklog = args[1];

    if (typeof hostOrBacklog === 'string') {
      const host = hostOrBacklog === '0.0.0.0' ? '127.0.0.1' : hostOrBacklog;
      return originalServerListen.call(this, port, host, ...args.slice(2));
    }

    if (typeof hostOrBacklog === 'number') {
      return originalServerListen.call(this, port, '127.0.0.1', hostOrBacklog, ...args.slice(2));
    }

    if (typeof hostOrBacklog === 'function' || hostOrBacklog === undefined) {
      return originalServerListen.call(this, port, '127.0.0.1', hostOrBacklog as any, ...args.slice(2));
    }
  }

  return originalServerListen.apply(this, args);
};
