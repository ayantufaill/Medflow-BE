import { Router } from 'express';
import { feeManagementController } from '../controllers/fee-management.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate);

/**
 * @swagger
 * /fee-management/guides:
 *   get:
 *     summary: Retrieve all fee schedules
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of fee schedules
 */
router.get('/guides', feeManagementController.getFeeSchedules.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/codes:
 *   get:
 *     summary: Retrieve and search procedure codes
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of procedure codes
 */
router.get('/codes', feeManagementController.getProcedureCodes.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/codes/{procCode}/fees:
 *   get:
 *     summary: Get fee schedule values for a procedure code
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: procCode
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Fee values list
 */
router.get('/codes/:procCode/fees', feeManagementController.getProcedureFees.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/codes/{procCode}/fees:
 *   put:
 *     summary: Bulk update fee schedule values for a procedure code
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: procCode
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fees:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     feeSchedNum: { type: string }
 *                     amount: { type: number }
 *     responses:
 *       200:
 *         description: Updated fee values list
 */
router.put('/codes/:procCode/fees', feeManagementController.updateProcedureFees.bind(feeManagementController));

export default router;
