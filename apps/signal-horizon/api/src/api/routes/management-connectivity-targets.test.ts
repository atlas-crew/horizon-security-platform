import { describe, it, expect } from 'vitest';
import {
  checkConnectivityPortAllowlist,
  defaultPortForTestType,
  getAllowlistedConnectivityPorts,
  getAllowlistedConnectivityTargets,
  normalizeConnectivityTarget,
  parseConnectivityTargetSpec,
} from './management.js';

describe('Management connectivity target helpers', () => {
  it('normalizeConnectivityTarget: extracts hostname from URL', () => {
    expect(normalizeConnectivityTarget('http://localhost:3000')).toBe('localhost');
    expect(normalizeConnectivityTarget('https://example.com:443/foo')).toBe('example.com');
  });

  it('normalizeConnectivityTarget: strips host:port', () => {
    expect(normalizeConnectivityTarget('example.com:8080')).toBe('example.com');
    expect(normalizeConnectivityTarget('10.0.0.1:8080')).toBe('10.0.0.1');
  });

  it('normalizeConnectivityTarget: ignores empty/invalid', () => {
    expect(normalizeConnectivityTarget('   ')).toBeUndefined();
    expect(normalizeConnectivityTarget(null)).toBeUndefined();
  });

  it('getAllowlistedConnectivityTargets: builds set from config URLs', () => {
    const allow = getAllowlistedConnectivityTargets({
      riskServer: { url: 'http://localhost:3100' },
      synapseDirect: { url: 'http://10.0.0.2:8080', enabled: true },
    });

    expect(allow.has('localhost')).toBe(true);
    expect(allow.has('10.0.0.2')).toBe(true);
  });

  it('getAllowlistedConnectivityTargets: includes demo targets in dev', () => {
    const allow = getAllowlistedConnectivityTargets({
      isDev: true,
      riskServer: { url: 'http://localhost:3100' },
      synapseDirect: { url: undefined, enabled: false },
    });

    expect(allow.has('demo.site')).toBe(true);
    expect(allow.has('apparatus')).toBe(true);
  });

  it('getAllowlistedConnectivityPorts: captures service ports + demo protocol ports in dev', () => {
    const ports = getAllowlistedConnectivityPorts({
      isDev: true,
      riskServer: { url: 'http://localhost:3100' },
      synapseDirect: { url: 'https://synapse.local:9443', enabled: true },
    });

    expect(ports.get('localhost')?.has(3100)).toBe(true);
    expect(ports.get('synapse.local')?.has(9443)).toBe(true);
    expect(ports.get('demo.site')?.has(50051)).toBe(true);
    expect(ports.get('apparatus')?.has(1883)).toBe(true);
  });

  it('parseConnectivityTargetSpec: parses URL/host:port/ipv6', () => {
    expect(parseConnectivityTargetSpec('http://demo.site/echo')?.host).toBe('demo.site');
    expect(parseConnectivityTargetSpec('http://demo.site/echo')?.port).toBe(80);
    expect(parseConnectivityTargetSpec('demo.site:9000')?.port).toBe(9000);
    expect(parseConnectivityTargetSpec('[::1]:443')?.host).toBe('::1');
    expect(parseConnectivityTargetSpec('[::1]:443')?.port).toBe(443);
  });

  it('defaultPortForTestType: returns protocol defaults', () => {
    expect(defaultPortForTestType('http1')).toBe(80);
    expect(defaultPortForTestType('grpc')).toBe(50051);
    expect(defaultPortForTestType('nope')).toBeUndefined();
  });

  it('checkConnectivityPortAllowlist: blocks disallowed ports for allowlisted hosts', () => {
    const allowlistedPorts = new Map<string, Set<number>>([['demo.site', new Set([80])]]);

    expect(
      checkConnectivityPortAllowlist({
        testType: 'http1',
        effectiveHost: 'demo.site',
        effectiveTarget: 'http://demo.site:80/echo',
        allowPrivate: true,
        allowlistedPorts,
      }).ok
    ).toBe(true);

    expect(
      checkConnectivityPortAllowlist({
        testType: 'redis',
        effectiveHost: 'demo.site',
        effectiveTarget: 'demo.site:6379',
        allowPrivate: true,
        allowlistedPorts,
      }).ok
    ).toBe(false);
  });
});
