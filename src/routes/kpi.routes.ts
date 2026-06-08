import { Router } from 'express';
import { kpiController } from '../controllers/kpi.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

/**
 * @swagger
 * /kpis:
 *   get:
 *     summary: Get rolling 12-month consolidated KPI metrics
 *     tags: [KPI Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Consolidated KPIs compiled successfully
 */
router.get(
  '/',
  authenticate,
  requirePermission('reports.read'),
  kpiController.getMainKpis.bind(kpiController)
);

/**
 * @swagger
 * /kpis/providers:
 *   get:
 *     summary: Get provider-level 12-month metrics
 *     tags: [KPI Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Provider KPI stats compiled successfully
 */
router.get(
  '/providers',
  authenticate,
  requirePermission('reports.read'),
  kpiController.getProviderKpis.bind(kpiController)
);

export default router;
