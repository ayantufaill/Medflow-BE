import { Router } from 'express';
import { financeDashboardController } from '../controllers/finance-dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { patientIdParamValidator } from '../validators/finance-dashboard.validator';

const router = Router();

/**
 * @swagger
 * /finance-dashboard/ledger/{patientId}:
 *   get:
 *     summary: Get chronological ledger for a patient
 *     tags: [Finance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Patient ledger
 *       404:
 *         description: Patient not found
 */
router.get(
  '/ledger/:patientId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('invoices.read'),
  validate(patientIdParamValidator),
  financeDashboardController.getLedger.bind(financeDashboardController)
);

/**
 * @swagger
 * /finance-dashboard/aging/{patientId}:
 *   get:
 *     summary: Get aging report for a patient
 *     tags: [Finance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Aging report (0-30, 31-60, 61-90, 90+)
 *       404:
 *         description: Patient not found
 */
router.get(
  '/aging/:patientId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('invoices.read'),
  validate(patientIdParamValidator),
  financeDashboardController.getAging.bind(financeDashboardController)
);

/**
 * @swagger
 * /finance-dashboard/overview:
 *   get:
 *     summary: Get practice-wide finance overview
 *     tags: [Finance Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Practice-wide financial summary
 */
router.get(
  '/overview',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('invoices.read'),
  financeDashboardController.getGlobalOverview.bind(financeDashboardController)
);

export default router;
