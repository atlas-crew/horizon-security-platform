#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const releaseRoot = path.join(appRoot, 'out', 'signal-horizon-standalone');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const nodeAuthToken = process.env.NODE_AUTH_TOKEN || process.env.NPM_REGISTRY_TOKEN;

run('pnpm', ['signal-horizon:release']);

if (!dryRun && !nodeAuthToken) {
  throw new Error('Set NODE_AUTH_TOKEN or NPM_REGISTRY_TOKEN before publishing Signal Horizon to npm.');
}

const publishArgs = ['publish', '--no-git-checks'];
if (dryRun) {
  publishArgs.splice(1, 0, '--dry-run');
}

run('pnpm', publishArgs, {
  cwd: releaseRoot,
  env: {
    ...process.env,
    ...(nodeAuthToken ? { NODE_AUTH_TOKEN: nodeAuthToken } : {}),
  },
});
