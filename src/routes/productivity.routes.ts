import { Router } from 'express';
import { productivityController } from '../controllers/productivity.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/productivity/panel-summary:
 *   get:
 *     summary: Get daily productivity panel summary for Total, Dentist, and Hygienist
 *     tags: [Productivity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Target date (YYYY-MM-DD)
 *       - in: query
 *         name: providerId
 *         schema:
 *           type: string
 *         description: Optional provider ID ('all', 'Dentist', 'Hygienist', or numeric ID)
 *     responses:
 *       200:
 *         description: Productivity panel summary data
 *       400:
 *         description: Invalid date format
 *       401:
 *         description: Unauthorized
 */
router.get('/panel-summary', authenticate, productivityController.getPanelSummary);

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
