/**
 * Env bootstrap for local development.
 *
 * We intentionally support `.env.local` (and mode-specific variants) because the UI (Vite)
 * already uses them, and it's easy to accidentally place API vars there.
 *
 * Precedence (highest first), matching common tooling:
 * - .env.<mode>.local
 * - .env.local
 * - .env.<mode>
 * - .env
 *
 * We do NOT override real environment variables already set in the process.
 */

import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const mode = process.env.NODE_ENV || 'development';
const candidates = [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];

for (const filename of candidates) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) continue;
  dotenvConfig({ path, override: false });
}

