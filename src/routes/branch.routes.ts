import { Router } from 'express';
import { branchController } from '../controllers/branch.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { validate } from '../middleware/validation.middleware';
import { branchAnalyticsValidator } from '../validators/branch.validator';

const router = Router();
router.use(authenticate);
router.use(resolveBranchAccess);
router.use(enterTenantContext);

/**
 * @swagger
 * /branches:
 *   get:
 *     summary: Get the branches the authenticated user may access
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of accessible branches
 */
router.get('/', branchController.getBranches.bind(branchController));

/**
 * @swagger
 * /branches/analytics:
 *   get:
 *     summary: Appointment analytics for one branch, or summed across all accessible branches
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema: { type: string }
 *         description: A branch id from GET /branches, or "all" (default) for the summed view
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Optional range start (ISO 8601). Defaults to the start of the current calendar year.
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Optional range end (ISO 8601). Defaults to the end of the current calendar year.
 *     responses:
 *       200:
 *         description: Appointment analytics
 */
router.get(
  '/analytics',
  validate(branchAnalyticsValidator),
  branchController.getBranchAnalytics.bind(branchController)
);

export default router;
