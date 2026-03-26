import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveBundledUiDir, shouldServeAppShell } from './app-shell.js';

describe('resolveBundledUiDir', () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => fs.rm(root, { force: true, recursive: true }))
    );
  });

  it('prefers an explicit UI dist directory when it contains index.html', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tmp-app-shell-'));
    tempRoots.push(root);

    const explicitDir = path.join(root, 'explicit-ui');
    const modulePublicDir = path.join(root, 'module', 'public');

    await fs.mkdir(explicitDir, { recursive: true });
    await fs.mkdir(modulePublicDir, { recursive: true });
    await fs.writeFile(path.join(explicitDir, 'index.html'), '<html>explicit</html>');
    await fs.writeFile(path.join(modulePublicDir, 'index.html'), '<html>module</html>');

    expect(
      resolveBundledUiDir({
        cwd: root,
        explicitUiDist: explicitDir,
        moduleDir: path.join(root, 'module'),
      })
    ).toBe(explicitDir);
  });

  it('falls back to a bundled public directory next to the compiled API entrypoint', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tmp-app-shell-'));
    tempRoots.push(root);

    const moduleDir = path.join(root, 'dist');
    const publicDir = path.join(moduleDir, 'public');

    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(path.join(publicDir, 'index.html'), '<html>bundled</html>');

    expect(resolveBundledUiDir({ cwd: root, moduleDir })).toBe(publicDir);
  });

  it('falls back to a cwd-relative dist/public directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tmp-app-shell-'));
    tempRoots.push(root);

    const publicDir = path.join(root, 'dist', 'public');
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(path.join(publicDir, 'index.html'), '<html>cwd-public</html>');

    expect(
      resolveBundledUiDir({
        cwd: root,
        moduleDir: path.join(root, 'module'),
      })
    ).toBe(publicDir);
  });

  it('falls back to a sibling ui/dist directory relative to cwd', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tmp-app-shell-'));
    tempRoots.push(root);

    const apiDir = path.join(root, 'api');
    const siblingUiDist = path.join(root, 'ui', 'dist');

    await fs.mkdir(apiDir, { recursive: true });
    await fs.mkdir(siblingUiDist, { recursive: true });
    await fs.writeFile(path.join(siblingUiDist, 'index.html'), '<html>sibling-ui</html>');

    expect(
      resolveBundledUiDir({
        cwd: apiDir,
        moduleDir: path.join(root, 'module'),
      })
    ).toBe(siblingUiDist);
  });

  it('returns null when no candidate directory contains a UI bundle', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tmp-app-shell-'));
    tempRoots.push(root);

    expect(
      resolveBundledUiDir({
        cwd: root,
        moduleDir: path.join(root, 'module'),
      })
    ).toBeNull();
  });
});

describe('shouldServeAppShell', () => {
  it('serves client-side application routes', () => {
    expect(shouldServeAppShell('/')).toBe(true);
    expect(shouldServeAppShell('/fleet')).toBe(true);
    expect(shouldServeAppShell('/settings/admin')).toBe(true);
  });

  it('does not shadow API, health, websocket, or asset paths', () => {
    expect(shouldServeAppShell('/api/v1/fleet/health')).toBe(false);
    expect(shouldServeAppShell('/health')).toBe(false);
    expect(shouldServeAppShell('/ready')).toBe(false);
    expect(shouldServeAppShell('/metrics')).toBe(false);
    expect(shouldServeAppShell('/telemetry/ingest')).toBe(false);
    expect(shouldServeAppShell('/_sensor/report')).toBe(false);
    expect(shouldServeAppShell('/ws/dashboard')).toBe(false);
    expect(shouldServeAppShell('/assets/index-abc123.js')).toBe(false);
    expect(shouldServeAppShell('/favicon.ico')).toBe(false);
  });
});
