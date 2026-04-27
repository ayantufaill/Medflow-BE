import { Router } from 'express';
import { estimateController } from '../controllers/estimate.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  estimateIdValidator,
  estimateSearchValidator,
  createEstimateValidator,
  updateEstimateValidator,
  convertEstimateValidator,
  declineEstimateValidator,
} from '../validators/estimate.validator';
import { patientIdValidator } from '../validators/patient.validator';

const router = Router();

/**
 * @swagger
 * /estimates:
 *   get:
 *     summary: Get all estimates
 *     tags: [Estimates]
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
 *         name: status
 *         schema: { type: string, enum: [draft, sent, accepted, declined, expired] }
 *     responses:
 *       200:
 *         description: List of estimates
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  requirePermission('invoices.read'),
  validate(estimateSearchValidator),
  estimateController.getAllEstimates.bind(estimateController)
);

/**
 * @swagger
 * /estimates/patient/{patientId}:
 *   get:
 *     summary: Get estimates by patient
 *     tags: [Estimates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of patient estimates
 */
router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('invoices.read'),
  validate(patientIdValidator),
  estimateController.getEstimatesByPatient.bind(estimateController)
);

/**
 * @swagger
 * /estimates/{estimateId}:
 *   get:
 *     summary: Get estimate by ID
 *     tags: [Estimates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estimate details
 *       404:
 *         description: Estimate not found
 */
router.get(
  '/:estimateId',
  authenticate,
  requirePermission('invoices.read'),
  validate(estimateIdValidator),
  estimateController.getEstimateById.bind(estimateController)
);

/**
 * @swagger
 * /estimates:
 *   post:
 *     summary: Create new estimate
 *     tags: [Estimates]
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
 *               - items
 *               - description
 *               - estimatedAmount
 *             properties:
 *               patientId:
 *                 type: integer
 *                 description: Patient ID (must be a valid patient ID, not 0)
 *                 example: 1
 *               description:
 *                 type: string
 *                 description: Description of the estimate
 *                 example: "Dental cleaning and X-rays estimate"
 *               estimatedAmount:
 *                 type: number
 *                 description: Total estimated amount
 *                 example: 350.00
 *               items:
 *                 type: array
 *                 description: List of items/services
 *                 items:
 *                   type: object
 *                   required:
 *                     - description
 *                     - quantity
 *                     - unitPrice
 *                   properties:
 *                     description:
 *                       type: string
 *                       description: Item description
 *                       example: "Dental Cleaning"
 *                     quantity:
 *                       type: integer
 *                       description: Quantity
 *                       example: 1
 *                     unitPrice:
 *                       type: number
 *                       description: Unit price
 *                       example: 150.00
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *                 example: "Valid for 30 days"
 *               expirationDays:
 *                 type: integer
 *                 description: Number of days until estimate expires
 *                 default: 30
 *                 example: 30
 *     responses:
 *       201:
 *         description: Estimate created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input - missing required fields or invalid patient ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Patient not found
 */
router.post(
  '/',
  authenticate,
  requirePermission('invoices.create'),
  validate(createEstimateValidator),
  estimateController.createEstimate.bind(estimateController)
);

/**
 * @swagger
 * /estimates/{estimateId}:
 *   patch:
 *     summary: Update estimate
 *     tags: [Estimates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               estimatedAmount:
 *                 type: number
 *               items:
 *                 type: array
 *               notes:
 *                 type: string
 *               expirationDays:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Estimate updated
 *       404:
 *         description: Estimate not found
 */
router.patch(
  '/:estimateId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...estimateIdValidator, ...updateEstimateValidator]),
  estimateController.updateEstimate.bind(estimateController)
);

/**
 * @swagger
 * /estimates/{estimateId}:
 *   delete:
 *     summary: Delete estimate
 *     tags: [Estimates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estimate deleted
 *       404:
 *         description: Estimate not found
 */
router.delete(
  '/:estimateId',
  authenticate,
  requirePermission('invoices.delete'),
  validate(estimateIdValidator),
  estimateController.deleteEstimate.bind(estimateController)
);

/**
 * @swagger
 * /estimates/{estimateId}/convert:
 *   post:
 *     summary: Convert estimate to invoice
 *     tags: [Estimates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema: { type: integer }
 *         description: Estimate ID to convert
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentId
 *               - dueDate
 *             properties:
 *               appointmentId:
 *                 type: integer
 *                 description: Appointment ID associated with the invoice
 *                 example: 1
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 description: Invoice due date (YYYY-MM-DD)
 *                 example: "2026-05-27"
 *               invoiceNotes:
 *                 type: string
 *                 description: Additional notes for the invoice
 *                 example: "Converted from estimate #123"
 *     responses:
 *       201:
 *         description: Invoice created from estimate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input - missing appointmentId or dueDate
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Estimate not found
 */
router.post(
  '/:estimateId/convert',
  authenticate,
  requirePermission('invoices.create'),
  validate([...estimateIdValidator, ...convertEstimateValidator]),
  estimateController.convertToInvoice.bind(estimateController)
);

/**
 * @swagger
 * /estimates/{estimateId}/send:
 *   post:
 *     summary: Send estimate to patient
 *     tags: [Estimates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estimate sent
 *       404:
 *         description: Estimate not found
 */
router.post(
  '/:estimateId/send',
  authenticate,
  requirePermission('invoices.update'),
  validate(estimateIdValidator),
  estimateController.sendToPatient.bind(estimateController)
);

/**
 * @swagger
 * /estimates/{estimateId}/accept:
 *   patch:
 *     summary: Accept estimate
 *     tags: [Estimates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estimate accepted
 */
router.patch(
  '/:estimateId/accept',
  authenticate,
  requirePermission('invoices.update'),
  validate(estimateIdValidator),
  estimateController.acceptEstimate.bind(estimateController)
);

/**
 * @swagger
 * /estimates/{estimateId}/decline:
 *   patch:
 *     summary: Decline estimate
 *     tags: [Estimates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Patient chose alternative treatment"
 *     responses:
 *       200:
 *         description: Estimate declined
 */
router.patch(
  '/:estimateId/decline',
  authenticate,
  requirePermission('invoices.update'),
  validate([...estimateIdValidator, ...declineEstimateValidator]),
  estimateController.declineEstimate.bind(estimateController)
);

/**
 * @swagger
 * /estimates/{estimateId}/expire:
 *   patch:
 *     summary: Expire estimate
 *     tags: [Estimates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estimate expired
 */
router.patch(
  '/:estimateId/expire',
  authenticate,
  requirePermission('invoices.update'),
  validate(estimateIdValidator),
  estimateController.expireEstimate.bind(estimateController)
);

export default router;