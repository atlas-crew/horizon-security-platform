#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const uiRoot = path.join(appRoot, 'ui');
const apiRoot = path.join(appRoot, 'api');
const uiDistDir = path.join(uiRoot, 'dist');
const bundledUiDir = path.join(apiRoot, 'dist', 'public');
const apiDistDir = path.join(apiRoot, 'dist');

await fs.access(path.join(uiDistDir, 'index.html')).catch(() => {
  throw new Error(`Missing UI build output at ${uiDistDir}. Run the UI build before bundling standalone assets.`);
});

await fs.access(path.join(apiDistDir, 'index.js')).catch(() => {
  throw new Error(`Missing API build output at ${apiDistDir}. Run the API build before bundling standalone assets.`);
});

await fs.rm(bundledUiDir, { force: true, recursive: true });
await fs.mkdir(bundledUiDir, { recursive: true });
await fs.cp(uiDistDir, bundledUiDir, { force: true, recursive: true });

process.stdout.write(`Standalone build ready at ${apiDistDir}\n`);
