import { Router } from 'express';
import { treatmentPlanController } from '../controllers/treatment-plan.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getTreatmentPlansValidator,
  treatmentPlanIdValidator,
  createTreatmentPlanValidator,
  updateTreatmentPlanValidator
} from '../validators/treatment-plan.validator';

const router = Router();

/**
 * @swagger
 * /treatment-plans:
 *   get:
 *     summary: Fetch all treatment plans (paginated, filter by patientId)
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully fetched treatment plans
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
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully fetched treatment plan
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
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientId:
 *                 type: string
 *               title:
 *                 type: string
 *               status:
 *                 type: string
 *               totalAmount:
 *                 type: number
 *               items:
 *                 type: array
 *     responses:
 *       201:
 *         description: Successfully created treatment plan
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
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *               totalAmount:
 *                 type: number
 *               items:
 *                 type: array
 *     responses:
 *       200:
 *         description: Successfully updated treatment plan
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
 *     tags: [Treatment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully deleted treatment plan
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission('clinical-notes.delete'),
  validate(treatmentPlanIdValidator),
  treatmentPlanController.deleteTreatmentPlan
);

export default router;
