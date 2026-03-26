import fs from 'node:fs';
import path from 'node:path';
import {
  APP_SHELL_RESERVED_PATHS,
  APP_SHELL_RESERVED_PREFIXES,
} from './top-level-route-paths.js';

const ASSET_EXTENSION_PATTERN =
  /\.(?:avif|css|gif|ico|jpeg|jpg|js|json|map|mjs|png|svg|txt|webmanifest|webp|woff2?)$/i;

const RESERVED_PATHS = new Set<string>(APP_SHELL_RESERVED_PATHS);

export interface UiBundleResolutionOptions {
  cwd?: string;
  explicitUiDist?: string;
  moduleDir: string;
}

export function resolveBundledUiDir(options: UiBundleResolutionOptions): string | null {
  const cwd = options.cwd ?? process.cwd();
  const candidates = [
    options.explicitUiDist,
    path.resolve(options.moduleDir, 'public'),
    path.resolve(cwd, 'dist/public'),
    path.resolve(cwd, '../ui/dist'),
    path.resolve(cwd, 'apps/signal-horizon/ui/dist'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return null;
}

/**
 * Expects a decoded, normalized pathname such as Express req.path.
 */
export function shouldServeAppShell(requestPath: string): boolean {
  if (!requestPath.startsWith('/')) {
    return false;
  }

  if (requestPath === '/') {
    return true;
  }

  if (RESERVED_PATHS.has(requestPath)) {
    return false;
  }

  if (
    APP_SHELL_RESERVED_PREFIXES.some(
      (prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`)
    )
  ) {
    return false;
  }

  if (ASSET_EXTENSION_PATTERN.test(requestPath)) {
    return false;
  }

  return true;
}
