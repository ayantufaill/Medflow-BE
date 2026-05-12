import { Router } from 'express';
import { rxController } from '../controllers/rx.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getRxValidator,
  createRxValidator
} from '../validators/rx.validator';

const router = Router();

/**
 * @swagger
 * /rx:
 *   get:
 *     summary: Get all prescriptions
 *     tags: [RX (Prescriptions)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of prescriptions
 */
router.get(
  '/',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(getRxValidator),
  rxController.getPrescriptions
);

/**
 * @swagger
 * /rx:
 *   post:
 *     summary: Create a new prescription
 *     tags: [RX (Prescriptions)]
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
 *               description:
 *                 type: string
 *               providerId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               duration:
 *                 type: string
 *               longTerm:
 *                 type: string
 *               refills:
 *                 type: string
 *               dose:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Prescription created successfully
 */
router.post(
  '/',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(createRxValidator),
  rxController.createPrescription
);

export default router;
