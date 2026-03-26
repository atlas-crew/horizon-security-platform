#!/usr/bin/env node

import { existsSync } from 'node:fs';
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

  if (result.error) {
    throw new Error(`Failed to spawn: ${command} ${args.join(' ')} - ${result.error.message}`);
  }

  if (result.status !== 0) {
    if (result.status === null && result.signal) {
      throw new Error(`Command killed by signal ${result.signal}: ${command} ${args.join(' ')}`);
    }

    throw new Error(`Command failed (exit ${result.status}): ${command} ${args.join(' ')}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const nodeAuthToken = process.env.NODE_AUTH_TOKEN || process.env.NPM_REGISTRY_TOKEN;

  run('pnpm', ['signal-horizon:release']);

  const publishArgs = ['publish', '--no-git-checks'];
  if (dryRun) {
    publishArgs.splice(1, 0, '--dry-run');
  }

  const releasePackageJson = path.join(releaseRoot, 'package.json');
  if (!existsSync(releaseRoot) || !existsSync(releasePackageJson)) {
    throw new Error(`Standalone release output not found at ${releaseRoot}`);
  }

  run('pnpm', publishArgs, {
    // Publishing happens from generated output, not from a git-tracked workspace package.
    cwd: releaseRoot,
    env: {
      ...process.env,
      ...(nodeAuthToken ? { NODE_AUTH_TOKEN: nodeAuthToken } : {}),
    },
  });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
