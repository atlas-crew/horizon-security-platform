import { describe, it, expect } from 'vitest';
import { getAllowlistedConnectivityTargets, normalizeConnectivityTarget } from './management.js';

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
});

