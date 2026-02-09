import { createHash, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import type { Rng } from './rng.js';

const scryptAsync = promisify(scryptCb);

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function scryptHash(password: string, saltHex: string): Promise<string> {
  const buf = (await scryptAsync(password, saltHex, 64)) as Buffer;
  return `${saltHex}:${buf.toString('hex')}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function randomIp(rng: Rng, blocks?: { a: number; b: number }[]): string {
  // Prefer public-ish ranges (not RFC1918) by default; can pass deterministic blocks.
  const presets =
    blocks ??
    ([
      { a: 45, b: 134 },
      { a: 52, b: 4 },
      { a: 104, b: 16 },
      { a: 185, b: 228 },
      { a: 203, b: 0 },
    ] as const);
  const { a, b } = rng.pick(presets);
  const c = rng.int(0, 255);
  const d = rng.int(1, 254);
  return `${a}.${b}.${c}.${d}`;
}

export function randomHex(rng: Rng, bytes: number): string {
  let out = '';
  for (let i = 0; i < bytes; i++) out += rng.int(0, 255).toString(16).padStart(2, '0');
  return out;
}

export function iso(dt: Date): string {
  return dt.toISOString();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

