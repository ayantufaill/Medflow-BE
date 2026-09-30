import { Router } from 'express';
import { securityController } from '../controllers/security.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Base path: /api/security/audit

/**
 * @swagger
 * /api/security/audit:
 *   get:
 *     tags:
 *       - Security
 *     summary: Query audit logs
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('security.audit.view'),
  securityController.getAuditLogs
);

/**
 * @swagger
 * /api/security/audit/verify:
 *   get:
 *     tags:
 *       - Security
 *     summary: Verify audit log chain
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/verify',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('security.audit.view'),
  securityController.verifyAudit
);

export default router;
