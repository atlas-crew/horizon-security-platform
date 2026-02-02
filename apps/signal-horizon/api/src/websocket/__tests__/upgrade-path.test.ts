import { describe, it, expect } from 'vitest';
import { matchUpgradePath } from '../upgrade-path.js';

const config = {
  sensorPath: '/ws/sensor',
  dashboardPath: '/ws/dashboard',
};

describe('matchUpgradePath', () => {
  it('matches configured sensor and dashboard paths', () => {
    expect(matchUpgradePath('/ws/sensor', config)).toEqual({
      type: 'sensor',
      path: '/ws/sensor',
    });
    expect(matchUpgradePath('/ws/sensor/', config)).toEqual({
      type: 'sensor',
      path: '/ws/sensor',
    });
    expect(matchUpgradePath('/ws/dashboard?tenant=demo', config)).toEqual({
      type: 'dashboard',
      path: '/ws/dashboard',
    });
  });

  it('rejects absolute-form and authority-form urls', () => {
    expect(matchUpgradePath('http://evil.test/ws/sensor', config)).toBeNull();
    expect(matchUpgradePath('//evil.test/ws/sensor', config)).toBeNull();
  });

  it('rejects encoded traversal and separator tricks', () => {
    expect(matchUpgradePath('/ws/%2e%2e/dashboard', config)).toBeNull();
    expect(matchUpgradePath('/ws%2ftunnel/sensor', config)).toBeNull();
    expect(matchUpgradePath('/ws/tunnel/../sensor', config)).toBeNull();
  });

  it('matches tunnel paths with safe prefixes', () => {
    expect(matchUpgradePath('/ws/tunnel/sensor/alpha', config)).toEqual({
      type: 'tunnel-sensor',
      path: '/ws/tunnel/sensor/alpha',
    });
    expect(matchUpgradePath('/ws/tunnel/user/beta', config)).toEqual({
      type: 'tunnel-user',
      path: '/ws/tunnel/user/beta',
    });
    expect(matchUpgradePath('/ws/tunnel/other', config)).toEqual({
      type: 'tunnel-unknown',
      path: '/ws/tunnel/other',
    });
  });
});
