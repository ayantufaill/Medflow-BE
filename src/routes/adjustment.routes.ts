import { Router } from 'express';
import { adjustmentController } from '../controllers/adjustment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  adjustmentIdValidator,
  patientIdParamValidator,
  adjustmentSearchValidator,
  createAdjustmentValidator,
  updateAdjustmentValidator,
} from '../validators/adjustment.validator';

const router = Router();

/**
 * @swagger
 * /adjustments:
 *   get:
 *     summary: Get all adjustments
 *     tags: [Adjustments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: List of adjustments
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('adjustments.read'),
  validate(adjustmentSearchValidator),
  adjustmentController.getAllAdjustments.bind(adjustmentController)
);

/**
 * @swagger
 * /adjustments/patient/{patientId}:
 *   get:
 *     summary: Get adjustments by patient
 *     tags: [Adjustments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of adjustments for the patient
 */
router.get(
  '/patient/:patientId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('adjustments.read'),
  validate(patientIdParamValidator),
  adjustmentController.getAdjustmentsByPatient.bind(adjustmentController)
);

/**
 * @swagger
 * /adjustments/{adjustmentId}:
 *   get:
 *     summary: Get adjustment by ID
 *     tags: [Adjustments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adjustmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Adjustment details
 *       404:
 *         description: Adjustment not found
 */
router.get(
  '/:adjustmentId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('adjustments.read'),
  validate(adjustmentIdValidator),
  adjustmentController.getAdjustmentById.bind(adjustmentController)
);

/**
 * @swagger
 * /adjustments:
 *   post:
 *     summary: Create new adjustment
 *     tags: [Adjustments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - amount
 *               - date
 *             properties:
 *               patientId:
 *                 type: integer
 *               amount:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: integer
 *                 description: Definition ID for the adjustment type
 *               providerId:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Adjustment created
 *       400:
 *         description: Invalid input
 */
router.post(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('adjustments.create'),
  validate(createAdjustmentValidator),
  adjustmentController.createAdjustment.bind(adjustmentController)
);

/**
 * @swagger
 * /adjustments/{adjustmentId}:
 *   patch:
 *     summary: Update adjustment
 *     tags: [Adjustments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adjustmentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: integer
 *               providerId:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Adjustment updated
 *       404:
 *         description: Adjustment not found
 */
router.patch(
  '/:adjustmentId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('adjustments.update'),
  validate([...adjustmentIdValidator, ...updateAdjustmentValidator]),
  adjustmentController.updateAdjustment.bind(adjustmentController)
);

/**
 * @swagger
 * /adjustments/{adjustmentId}:
 *   delete:
 *     summary: Delete adjustment
 *     tags: [Adjustments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adjustmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Adjustment deleted
 *       404:
 *         description: Adjustment not found
 */
router.delete(
  '/:adjustmentId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('adjustments.delete'),
  validate(adjustmentIdValidator),
  adjustmentController.deleteAdjustment.bind(adjustmentController)
);

export default router;
