import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { createApiRouter } from './index.js';
import type { SigmaHuntService } from '../../services/sigma-hunt/index.js';

describe('createApiRouter sigma mount', () => {
  it('mounts /hunt/sigma when sigmaHuntService is provided without huntService', () => {
    const logger: Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown as Logger;

    const sigma = {} as SigmaHuntService;
    const router = createApiRouter({} as PrismaClient, logger, { sigmaHuntService: sigma });

    const stack = (router as any).stack as Array<{ regexp?: RegExp }>;
    const hasSigma = stack.some((layer) => String(layer.regexp ?? '').includes('hunt\\/sigma'));
    expect(hasSigma).toBe(true);
  });
});

