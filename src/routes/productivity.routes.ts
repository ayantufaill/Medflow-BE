import { Router } from 'express';
import { productivityController } from '../controllers/productivity.controller';

const router = Router();

/**
 * @swagger
 * /api/productivity/production-over-time:
 *   get:
 *     summary: Get daily production totals over a date range
 *     tags: [Productivity]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Array of production data points
 */
router.get('/production-over-time', productivityController.getProductionOverTime);

/**
 * @swagger
 * /api/productivity/production-by-provider:
 *   get:
 *     summary: Get production totals grouped by provider
 *     tags: [Productivity]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Array of production by provider
 */
router.get('/production-by-provider', productivityController.getProductionByProvider);

/**
 * @swagger
 * /api/productivity/production-by-operatory:
 *   get:
 *     summary: Get production totals grouped by operatory
 *     tags: [Productivity]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Array of production by operatory
 */
router.get('/production-by-operatory', productivityController.getProductionByOperatory);

export default router;
