import { Router } from 'express';
import { feeManagementController } from '../controllers/fee-management.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate);
router.use(resolveBranchAccess);
router.use(enterTenantContext);

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
 *         description: Fees updated
 */
router.put('/codes/:procCode/fees', feeManagementController.updateProcedureFees.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides/{id}:
 *   get:
 *     summary: Retrieve single fee schedule by ID
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Fee schedule details
 *       404:
 *         description: Fee schedule not found
 */
router.get('/guides/:id', feeManagementController.getFeeScheduleById.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides:
 *   post:
 *     summary: Create a new fee schedule
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [description]
 *             properties:
 *               description: { type: string }
 *               feeSchedType: { type: integer }
 *               isGlobal: { type: boolean }
 *     responses:
 *       201:
 *         description: Fee schedule created
 */
router.post('/guides', feeManagementController.createFeeSchedule.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides/{id}:
 *   put:
 *     summary: Update an existing fee schedule
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *               feeSchedType: { type: integer }
 *               isHidden: { type: boolean }
 *               isGlobal: { type: boolean }
 *     responses:
 *       200:
 *         description: Fee schedule updated
 */
router.put('/guides/:id', feeManagementController.updateFeeSchedule.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides/{id}:
 *   delete:
 *     summary: Delete a fee schedule (soft delete)
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Fee schedule deleted
 */
router.delete('/guides/:id', feeManagementController.deleteFeeSchedule.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides/{id}/copy:
 *   post:
 *     summary: Copy a fee schedule
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Fee schedule copied
 */
router.post('/guides/:id/copy', feeManagementController.copyFeeSchedule.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides/{id}/fees:
 *   get:
 *     summary: Retrieve fees for a schedule with pagination/filters
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
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
 *         description: List of fees
 */
router.get('/guides/:id/fees', feeManagementController.getFeeScheduleFees.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides/{id}/fees:
 *   put:
 *     summary: Bulk update/upsert fees for a schedule
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *                     procCode: { type: string }
 *                     amount: { type: number }
 *     responses:
 *       200:
 *         description: Fees updated
 */
router.put('/guides/:id/fees', feeManagementController.updateFeeScheduleFees.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides/{id}/round:
 *   post:
 *     summary: Round fees to nearest value
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               toNearest: { type: number }
 *     responses:
 *       200:
 *         description: Fees rounded
 */
router.post('/guides/:id/round', feeManagementController.roundFeeScheduleFees.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides/{id}/set-provider:
 *   post:
 *     summary: Set provider default fee schedule
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               providerId: { type: string }
 *     responses:
 *       200:
 *         description: Provider schedule updated
 */
router.post('/guides/:id/set-provider', feeManagementController.setProviderFeeSchedule.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/guides/{id}/upload:
 *   post:
 *     summary: Upload and import fees
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *                     procCode: { type: string }
 *                     amount: { type: number }
 *     responses:
 *       200:
 *         description: Fees imported
 */
router.post('/guides/:id/upload', feeManagementController.uploadFeeScheduleFees.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/tools/reestimate:
 *   post:
 *     summary: Reestimate treatment plans
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Treatment plans reestimated
 */
router.post('/tools/reestimate', feeManagementController.reestimateTPlans.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/tools/clear-locked:
 *   post:
 *     summary: Clear locked fees
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Locked fees cleared
 */
router.post('/tools/clear-locked', feeManagementController.clearLockedFees.bind(feeManagementController));

/**
 * @swagger
 * /fee-management/tools/reset-tplans:
 *   post:
 *     summary: Reset treatment plans
 *     tags: [Fee Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Treatment plans reset
 */
router.post('/tools/reset-tplans', feeManagementController.resetTPlans.bind(feeManagementController));

export default router;
