import { Router } from 'express';
import { reportingController } from '../controllers/reporting.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

/**
 * @swagger
 * /reports/run:
 *   post:
 *     summary: Run a dynamic report with filters
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [kind, filters, columns]
 *             properties:
 *               kind: { type: string, enum: [Patient, Procedures, Revenue] }
 *               filters: 
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     field: { type: string }
 *                     operator: { type: string, enum: [equals, contains, gt, lt, gte, lte, in] }
 *                     value: { type: object }
 *               columns:
 *                 type: array
 *                 items: { type: string }
 *               page: { type: integer }
 *               limit: { type: integer }
 *     responses:
 *       200:
 *         description: Report results
 */
router.post(
  '/run',
  authenticate,
  requirePermission('reports.read'),
  reportingController.runReport.bind(reportingController)
);

export default router;
