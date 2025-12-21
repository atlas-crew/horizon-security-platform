/**
 * API Routes Index
 * Combines all route modules with authentication
 */

import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createCampaignRoutes } from './campaigns.js';
import { createThreatRoutes } from './threats.js';
import { createBlocklistRoutes } from './blocklist.js';
import { createWarRoomRoutes } from './warroom.js';
import { createIntelRoutes } from './intel.js';
import { createHuntRoutes } from './hunt.js';
import type { HuntService } from '../../services/hunt/index.js';

export interface ApiRouterOptions {
  huntService?: HuntService;
}

export function createApiRouter(
  prisma: PrismaClient,
  logger: Logger,
  options: ApiRouterOptions = {}
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(prisma);

  // All API routes require authentication
  router.use(authMiddleware);

  // Mount route modules
  router.use('/campaigns', createCampaignRoutes(prisma));
  router.use('/threats', createThreatRoutes(prisma));
  router.use('/blocklist', createBlocklistRoutes(prisma));
  router.use('/warrooms', createWarRoomRoutes(prisma, logger));
  router.use('/intel', createIntelRoutes(prisma, logger));

  // Mount hunt routes if HuntService is provided
  if (options.huntService) {
    router.use('/hunt', createHuntRoutes(prisma, logger, options.huntService));
    logger.info('Hunt routes mounted at /api/v1/hunt');
  }

  return router;
}
