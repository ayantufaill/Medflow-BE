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
 *     description: Returns a paginated list of prescriptions, optionally filtered by patient. Each prescription includes a joined medication name resolved via RxCui matching against the medication table, falling back to the raw prescribed drug text if no match is found.
 *     tags: [RX (Prescriptions)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema: { type: string }
 *         description: Filter prescriptions by patient ID
 *         example: "1"
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, default: 25 }
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: Paginated list of prescriptions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     prescriptions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, example: "501" }
 *                           rxNum: { type: string, example: "501" }
 *                           description:
 *                             type: string
 *                             description: Raw prescribed drug text as entered at prescribing time
 *                             example: "Amoxicillin 500mg"
 *                           medicationName:
 *                             type: string
 *                             description: Canonical medication name joined via RxCui against the medication table; falls back to `description` if no RxCui match exists
 *                             example: "Amoxicillin"
 *                           startDate: { type: string, format: date, example: "2026-06-01" }
 *                           duration: { type: string, example: "7 days" }
 *                           longTerm: { type: string, example: "No" }
 *                           refills: { type: string, example: "1" }
 *                           dose: { type: string, example: "30" }
 *                           prints: { type: string, example: "0" }
 *                           provider: { type: string, example: "Dr. Sarah Mitchell" }
 *                           notes: { type: string, example: "Take twice daily with food" }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 25 }
 *                         total: { type: integer }
 *                         pages: { type: integer }
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.read permission
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
 *     description: Creates a new prescription, linked either to a specific medication via medicationId, or with a free-text description. At least one of medicationId or description is required.
 *     tags: [RX (Prescriptions)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId]
 *             properties:
 *               patientId:
 *                 type: string
 *                 example: "1"
 *               medicationId:
 *                 type: string
 *                 description: ID of a medication from the medication table. If provided, its canonical name and RxCui are linked to this prescription.
 *                 example: "42"
 *               description:
 *                 type: string
 *                 description: Free-text drug description. Required if medicationId is not provided.
 *                 example: "Amoxicillin 500mg"
 *               providerId:
 *                 type: string
 *                 example: "1"
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     prescription:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         rxNum: { type: string }
 *                         description: { type: string }
 *                         medicationId: { type: string, nullable: true }
 *                         startDate: { type: string, format: date }
 *                         duration: { type: string }
 *                         longTerm: { type: string }
 *                         refills: { type: string }
 *                         dose: { type: string }
 *                         provider: { type: string }
 *                         notes: { type: string }
 *                 message: { type: string, example: "Prescription created successfully" }
 *       400:
 *         description: Validation error — patientId missing, or neither medicationId nor description provided
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission
 *       404:
 *         description: medicationId provided but no matching medication found
 */
router.post(
  '/',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(createRxValidator),
  rxController.createPrescription
);
/**
 * @swagger
 * /rx/{id}/print:
 *   get:
 *     summary: Get formatted print data for a prescription
 *     description: Returns a structured JSON payload of a prescription formatted for printing, including patient and provider details and the joined medication name.
 *     tags: [RX (Prescriptions)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: "501"
 *     responses:
 *       200:
 *         description: Formatted prescription print data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     prescription:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         rxNum: { type: string }
 *                         medicationName: { type: string, example: "Amoxicillin" }
 *                         description: { type: string }
 *                         dose: { type: string }
 *                         refills: { type: string }
 *                         duration: { type: string }
 *                         longTerm: { type: string }
 *                         startDate: { type: string, format: date }
 *                         notes: { type: string }
 *                         patient:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id: { type: string }
 *                             name: { type: string, example: "John Smith" }
 *                             birthdate: { type: string, format: date }
 *                             address: { type: string }
 *                             city: { type: string }
 *                             state: { type: string }
 *                             zip: { type: string }
 *                             phone: { type: string }
 *                         provider:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id: { type: string }
 *                             name: { type: string, example: "Dr. Sarah Mitchell" }
 *                         printedAt: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.read permission
 *       404:
 *         description: Prescription not found
 */
router.get(
  '/:id/print',
  authenticate,
  requirePermission('clinical-notes.read'),
  rxController.printPrescription
);
export default router;
