import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { requireScope } from '../../middleware/auth.js';
import { asyncHandler, handleValidationError } from '../../../lib/errors.js';
import { sendProblem } from '../../../lib/problem-details.js';
import { CreateRuleSchema, UpdateRuleSchema, UUIDParamSchema } from './validation.js';
import type { SecurityAuditService } from '../../../services/audit/security-audit.js';

export function createRulesRouter(
  prisma: PrismaClient,
  logger: Logger,
  auditService?: SecurityAuditService
): Router {
  const router = Router();

  // GET /api/v1/beam/rules - List all customer rules
  router.get('/', requireScope('rules:read', 'dashboard:read'), asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;

    const rules = await prisma.customerRule.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { deployments: true, endpointBindings: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
    });

    logger.info({ tenantId, count: rules.length }, 'Rules fetched successfully');

    return res.json({ rules });
  }));

  // GET /api/v1/beam/rules/:id - Get rule details
  router.get('/:id', requireScope('rules:read', 'dashboard:read'), asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;

    // Validate UUID parameter
    const paramValidation = UUIDParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return handleValidationError(res, paramValidation.error);
    }

    const { id } = paramValidation.data;

    const rule = await prisma.customerRule.findFirst({
      where: { id, tenantId },
      include: {
        deployments: {
          include: {
            sensor: {
              select: { id: true, name: true, connectionState: true }
            }
          }
        },
        endpointBindings: {
          include: {
            endpoint: {
              select: {
                id: true,
                method: true,
                pathTemplate: true,
                service: true
              }
            }
          }
        }
      }
    });

    if (!rule) {
      return sendProblem(res, 404, 'Rule not found', {
        code: 'NOT_FOUND',
        instance: req.originalUrl,
      });
    }

    logger.info({ tenantId, ruleId: id }, 'Rule details fetched successfully');

    return res.json({ rule });
  }));

  // POST /api/v1/beam/rules - Create a new rule
  router.post('/', requireScope('rules:write'), asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;

    // Validate request body
    const bodyValidation = CreateRuleSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return handleValidationError(res, bodyValidation.error);
    }

    const rule = await prisma.customerRule.create({
      data: {
        ...bodyValidation.data,
        tenantId,
      }
    });

    if (auditService) {
      await auditService.logEvent(auditService.extractRequestContext(req), {
        action: 'RULE_CREATED',
        result: 'SUCCESS',
        resourceId: rule.id,
        details: { name: rule.name, category: rule.category },
      });
    }

    logger.info({ tenantId, ruleId: rule.id }, 'Rule created successfully');

    return res.status(201).json({ rule });
  }));

  // PATCH /api/v1/beam/rules/:id - Update rule properties (e.g. toggle enabled)
  router.patch('/:id', requireScope('rules:write'), asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;

    // Validate UUID parameter
    const paramValidation = UUIDParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return handleValidationError(res, paramValidation.error);
    }

    const { id } = paramValidation.data;

    // Validate request body
    const bodyValidation = UpdateRuleSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return handleValidationError(res, bodyValidation.error);
    }

    // Empty update guard
    if (Object.keys(bodyValidation.data).length === 0) {
      const rule = await prisma.customerRule.findFirst({
        where: { id, tenantId },
      });
      if (!rule) {
        return sendProblem(res, 404, 'Rule not found', {
          code: 'NOT_FOUND',
          instance: req.originalUrl,
        });
      }
      return res.json({ rule });
    }

    const existingRule = await prisma.customerRule.findFirst({
      where: { id, tenantId },
    });

    if (!existingRule) {
      return sendProblem(res, 404, 'Rule not found', {
        code: 'NOT_FOUND',
        instance: req.originalUrl,
      });
    }

    // Use updateMany to ensure tenant isolation during write
    await prisma.customerRule.updateMany({
      where: { id, tenantId },
      data: bodyValidation.data,
    });

    // Fetch the updated rule to return
    const rule = await prisma.customerRule.findUnique({
      where: { id },
    });

    if (auditService && rule) {
      // Log changes with delta (finding 8)
      const previousValues = {
        enabled: existingRule.enabled,
        severity: existingRule.severity,
        action: existingRule.action,
        sensitivity: existingRule.sensitivity,
        name: existingRule.name,
        description: existingRule.description,
        category: existingRule.category,
        patterns: existingRule.patterns,
        exclusions: existingRule.exclusions,
      };
      
      const changes = auditService.computeConfigDiff(
        previousValues as Record<string, unknown>,
        bodyValidation.data as Record<string, unknown>
      );

      await auditService.logEvent(auditService.extractRequestContext(req), {
        action: 'RULE_UPDATED',
        result: 'SUCCESS',
        resourceId: id,
        details: { 
          name: rule.name,
          changes,
          changeCount: changes.length
        },
      });
    }

    logger.info({ tenantId, ruleId: id, updates: Object.keys(bodyValidation.data) }, 'Rule updated successfully');

    return res.json({ rule });
  }));

  return router;
}
