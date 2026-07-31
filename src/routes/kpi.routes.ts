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
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional start date for custom range (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional end date for custom range (ISO format)
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
 * /kpis/summary:
 *   get:
 *     summary: Get top-card KPI summary (current month vs last month)
 *     tags: [KPI Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns Net Production, Total Collection, Seen Patients, and Case Accepted
 */
router.get(
  '/summary',
  authenticate,
  requirePermission('reports.read'),
  kpiController.getKpiSummary.bind(kpiController)
);

/**
 * @swagger
 * /kpis/providers:
 *   get:
 *     summary: Get provider-level 12-month metrics
 *     tags: [KPI Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional start date for custom range (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional end date for custom range (ISO format)
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
