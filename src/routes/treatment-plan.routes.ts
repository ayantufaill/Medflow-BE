import { Router } from 'express';
import { treatmentPlanController } from '../controllers/treatment-plan.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getTreatmentPlansValidator,
  treatmentPlanIdValidator,
  createTreatmentPlanValidator,
  updateTreatmentPlanValidator,
  reorderTreatmentPlanValidator
} from '../validators/treatment-plan.validator';

const router = Router();

/**
 * @swagger
 * /treatment-plans:
 *   get:
 *     summary: Fetch all treatment plans
 *     description: Returns a paginated list of treatment plans, optionally filtered by patient.
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, default: 10 }
 *         description: Number of records per page
 *       - in: query
 *         name: patientId
 *         schema: { type: string }
 *         description: Filter treatment plans by patient ID
 *         example: "1"
 *     responses:
 *       200:
 *         description: List of treatment plans with pagination metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatmentPlans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string, example: "1" }
 *                           patientId: { type: string, example: "1" }
 *                           title: { type: string, example: "Phase 1 Restorative Plan" }
 *                           notes: { type: string, nullable: true, description: "Raw stored note/meta JSON" }
 *                           status: { type: string, nullable: true, example: "active" }
 *                           totalAmount: { type: number, nullable: true, example: 1250.00 }
 *                           items:
 *                             type: array
 *                             items: { type: object }
 *                           createdAt: { type: string, format: date-time, nullable: true }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         total: { type: integer }
 *                         pages: { type: integer }
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.read permission
 */
router.get(
  '/',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(getTreatmentPlansValidator),
  treatmentPlanController.getAllTreatmentPlans
);

/**
 * @swagger
 * /treatment-plans/{id}:
 *   get:
 *     summary: Fetch a specific treatment plan by ID
 *     description: Returns full details of a single treatment plan, including its line items.
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the treatment plan (TreatPlanNum)
 *         example: "1"
 *     responses:
 *       200:
 *         description: Treatment plan details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatmentPlan:
 *                       type: object
 *                       properties:
 *                         _id: { type: string, example: "1" }
 *                         patientId: { type: string, example: "1" }
 *                         title: { type: string, example: "Phase 1 Restorative Plan" }
 *                         notes: { type: string, nullable: true, description: "Raw stored note/meta JSON" }
 *                         status: { type: string, nullable: true, example: "active" }
 *                         totalAmount: { type: number, nullable: true, example: 1250.00 }
 *                         items:
 *                           type: array
 *                           items: { type: object }
 *                         createdAt: { type: string, format: date-time, nullable: true }
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.read permission
 *       404:
 *         description: Treatment plan not found
 */
router.get(
  '/:id',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(treatmentPlanIdValidator),
  treatmentPlanController.getTreatmentPlanById
);

/**
 * @swagger
 * /treatment-plans:
 *   post:
 *     summary: Create a new treatment plan
 *     description: Creates a new treatment plan for a patient with an optional list of line items. Status, totalAmount, and items are stored together as JSON metadata.
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, title]
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: ID of the patient this plan belongs to
 *                 example: "1"
 *               title:
 *                 type: string
 *                 description: Title or heading of the treatment plan
 *                 example: "Phase 1 Restorative Plan"
 *               status:
 *                 type: string
 *                 description: Status of the treatment plan
 *                 example: "active"
 *               totalAmount:
 *                 type: number
 *                 description: Total estimated cost of the treatment plan
 *                 example: 1250.00
 *               items:
 *                 type: array
 *                 description: Line items for the treatment plan (procedures, fees, etc.)
 *                 items:
 *                   type: object
 *                   properties:
 *                     procedureCode: { type: string, example: "D2750" }
 *                     description: { type: string, example: "Crown - porcelain fused to high noble metal" }
 *                     tooth: { type: string, example: "14" }
 *                     fee: { type: number, example: 850.00 }
 *     responses:
 *       201:
 *         description: Treatment plan created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatmentPlan:
 *                       type: object
 *                       properties:
 *                         _id: { type: string, example: "1" }
 *                         patientId: { type: string, example: "1" }
 *                         title: { type: string, example: "Phase 1 Restorative Plan" }
 *                         notes: { type: string, nullable: true }
 *                         status: { type: string, nullable: true, example: "active" }
 *                         totalAmount: { type: number, nullable: true, example: 1250.00 }
 *                         items:
 *                           type: array
 *                           items: { type: object }
 *                         createdAt: { type: string, format: date-time, nullable: true }
 *       400:
 *         description: Validation error — missing or invalid fields
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission
 */
router.post(
  '/',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(createTreatmentPlanValidator),
  treatmentPlanController.createTreatmentPlan
);

/**
 * @swagger
 * /treatment-plans/{id}:
 *   patch:
 *     summary: Update an existing treatment plan
 *     description: Updates fields of an existing treatment plan. Only provided fields are merged into the stored metadata; omitted fields retain their existing values.
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the treatment plan to update (TreatPlanNum)
 *         example: "1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Updated title/heading of the treatment plan
 *                 example: "Phase 1 Restorative Plan - Revised"
 *               status:
 *                 type: string
 *                 description: Updated status of the treatment plan
 *                 example: "completed"
 *               totalAmount:
 *                 type: number
 *                 description: Updated total estimated cost
 *                 example: 1100.00
 *               items:
 *                 type: array
 *                 description: Updated line items for the treatment plan (replaces existing items entirely)
 *                 items:
 *                   type: object
 *                   properties:
 *                     procedureCode: { type: string, example: "D2750" }
 *                     description: { type: string, example: "Crown - porcelain fused to high noble metal" }
 *                     tooth: { type: string, example: "14" }
 *                     fee: { type: number, example: 850.00 }
 *     responses:
 *       200:
 *         description: Treatment plan updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatmentPlan:
 *                       type: object
 *                       properties:
 *                         _id: { type: string, example: "1" }
 *                         patientId: { type: string, example: "1" }
 *                         title: { type: string, example: "Phase 1 Restorative Plan - Revised" }
 *                         notes: { type: string, nullable: true }
 *                         status: { type: string, nullable: true, example: "completed" }
 *                         totalAmount: { type: number, nullable: true, example: 1100.00 }
 *                         items:
 *                           type: array
 *                           items: { type: object }
 *                         createdAt: { type: string, format: date-time, nullable: true }
 *       400:
 *         description: Validation error — invalid fields
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission
 *       404:
 *         description: Treatment plan not found
 */
router.patch(
  '/:id',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate([...treatmentPlanIdValidator, ...updateTreatmentPlanValidator]),
  treatmentPlanController.updateTreatmentPlan
);

/**
 * @swagger
 * /treatment-plans/{id}:
 *   delete:
 *     summary: Delete a treatment plan
 *     description: Permanently deletes a treatment plan by ID.
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the treatment plan to delete (TreatPlanNum)
 *         example: "1"
 *     responses:
 *       200:
 *         description: Treatment plan deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "Treatment plan deleted successfully" }
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.delete permission
 *       404:
 *         description: Treatment plan not found
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission('clinical-notes.delete'),
  validate(treatmentPlanIdValidator),
  treatmentPlanController.deleteTreatmentPlan
);

/**
 * @swagger
 * /treatment-plans/{id}/reorder:
 *   patch:
 *     summary: Reorder items in a treatment plan
 *     description: Accepts a sorted array of items and persists the new order to the database.
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the treatment plan (TreatPlanNum)
 *         example: "1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items: { type: object }
 *     responses:
 *       200:
 *         description: Items reordered successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Treatment plan not found
 */
router.patch(
  '/:id/reorder',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate([...treatmentPlanIdValidator, ...reorderTreatmentPlanValidator]),
  treatmentPlanController.reorderTreatmentPlanItems
);

/**
 * @swagger
 * /treatment-plans/{id}/print:
 *   get:
 *     summary: Get flattened treatment plan layout for printing
 *     description: Returns a print-preview layout of the treatment plan, flattening metadata and joining patient details.
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the treatment plan (TreatPlanNum)
 *         example: "1"
 *     responses:
 *       200:
 *         description: Print-ready layout returned successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Treatment plan not found
 */
router.get(
  '/:id/print',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(treatmentPlanIdValidator),
  treatmentPlanController.printTreatmentPlan
);

/**
 * @swagger
 * /treatment-plans/{id}/generate-claim:
 *   post:
 *     summary: Generate a claim from accepted treatment plan items
 *     description: Creates a draft claim from the accepted items (status=A) in a treatment plan.
 *     tags: [Treatment Plans, Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the treatment plan (TreatPlanNum)
 *         example: "1"
 *     responses:
 *       201:
 *         description: Claim generated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Treatment plan or patient insurance not found
 *       409:
 *         description: Claim already exists for this treatment plan
 *       422:
 *         description: No accepted items in treatment plan
 */
router.post(
  '/:id/generate-claim',
  authenticate,
  requirePermission('billing.write'),
  validate(treatmentPlanIdValidator),
  treatmentPlanController.generateClaim
);

export default router;