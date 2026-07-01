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
 *             properties:
 *               patientId:
 *                 type: integer
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                     unitPrice:
 *                       type: number
 *               notes:
 *                 type: string
 *               expirationDays:
 *                 type: integer
 *                 default: 30
 *     responses:
 *       201:
 *         description: Estimate created
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               invoiceNotes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Invoice created from estimate
 */
router.post(
  '/:estimateId/send',
  authenticate,
  requirePermission('invoices.update'),
  validate(estimateIdValidator),
  estimateController.sendToPatient.bind(estimateController)
);

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