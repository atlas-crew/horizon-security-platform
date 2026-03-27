import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..', '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    ...options,
  });

  if (result.error) {
    throw new Error(`Failed to spawn ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || `Command failed: ${command} ${args.join(' ')}`);
  }

  return result.stdout?.trim() ?? '';
}

function readVersionFromRef(relativePath, ref = 'HEAD') {
  const fileContents = run('git', ['show', `${ref}:${relativePath}`]);
  const pkg = JSON.parse(fileContents);
  return pkg.version;
}

function hasLocalTag(tagName) {
  const result = spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tagName}`], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function hasRemoteTag(tagName) {
  const result = spawnSync('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || 'Failed to query remote tags');
  }
  return result.stdout.trim().length > 0;
}

const allowedArgs = new Set(['--push', '--print-only']);
const args = new Set(process.argv.slice(2).filter((arg) => arg !== '--'));
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));
if (unknownArgs.length > 0) {
  throw new Error(`Unknown arguments: ${unknownArgs.join(', ')}`);
}

const push = args.has('--push');
const printOnly = args.has('--print-only');

const versions = {
  api: readVersionFromRef(path.join('apps', 'signal-horizon', 'api', 'package.json')),
  ui: readVersionFromRef(path.join('apps', 'signal-horizon', 'ui', 'package.json')),
};

const uniqueVersions = new Set(Object.values(versions));
if (uniqueVersions.size !== 1) {
  throw new Error(`Signal Horizon version mismatch: ${JSON.stringify(versions)}`);
}

const version = versions.api;
const tagName = `signal-horizon-v${version}`;
const headSha = run('git', ['rev-parse', 'HEAD']);
const shortSha = run('git', ['rev-parse', '--short', 'HEAD']);

if (hasLocalTag(tagName)) {
  throw new Error(`Local tag already exists: ${tagName}`);
}

if (hasRemoteTag(tagName)) {
  throw new Error(`Remote tag already exists on origin: ${tagName}`);
}

if (printOnly) {
  process.stdout.write([
    `Signal Horizon release tag is ready to create.`,
    `Version: ${version}`,
    `HEAD: ${shortSha} (${headSha})`,
    `Tag: ${tagName}`,
    `Create locally: git tag -a ${tagName} -m "signal-horizon ${version}"`,
    `Push: git push origin ${tagName}`,
    '',
  ].join('\n'));
  process.exit(0);
}

run('git', ['tag', '-a', tagName, '-m', `signal-horizon ${version}`], { stdio: 'inherit' });

if (push) {
  run('git', ['push', 'origin', tagName], { stdio: 'inherit' });
}

process.stdout.write([
  `Created ${tagName} at ${shortSha}.`,
  push
    ? `Pushed ${tagName} to origin.`
    : `Push it with: git push origin ${tagName}`,
  '',
].join('\n'));
