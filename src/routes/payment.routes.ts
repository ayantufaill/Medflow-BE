import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  paymentIdValidator,
  patientIdParamValidator,
  invoiceIdParamValidator,
  paymentSearchValidator,
  createPaymentValidator,
  applyPaymentValidator,
  voidPaymentValidator,
} from '../validators/payment.validator';

const router = Router();

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
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
 *         name: fromDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: method
 *         schema: { type: string, enum: [cash, check, credit_card, insurance] }
 *     responses:
 *       200:
 *         description: List of payments
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  requirePermission('payments.read'),
  validate(paymentSearchValidator),
  paymentController.getAllPayments.bind(paymentController)
);

/**
 * @swagger
 * /payments/patient/{patientId}:
 *   get:
 *     summary: Get payments by patient
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of patient payments
 */
router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('payments.read'),
  validate(patientIdParamValidator),
  paymentController.getPaymentsByPatient.bind(paymentController)
);

/**
 * @swagger
 * /payments/invoice/{invoiceId}:
 *   get:
 *     summary: Get payments by invoice
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of invoice payments
 */
router.get(
  '/invoice/:invoiceId',
  authenticate,
  requirePermission('payments.read'),
  validate(invoiceIdParamValidator),
  paymentController.getPaymentsByInvoice.bind(paymentController)
);

/**
 * @swagger
 * /payments/{paymentId}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Payment details
 *       404:
 *         description: Payment not found
 */
router.get(
  '/:paymentId',
  authenticate,
  requirePermission('payments.read'),
  validate(paymentIdValidator),
  paymentController.getPaymentById.bind(paymentController)
);

/**
 * @swagger
 * /payments:
 *   post:
 *     summary: Create new payment
 *     tags: [Payments]
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
 *               - method
 *             properties:
 *               patientId:
 *                 type: integer
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *                 enum: [cash, check, credit_card]
 *               checkNumber:
 *                 type: string
 *               notes:
 *                 type: string
 *               invoiceIds:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       201:
 *         description: Payment created
 *       400:
 *         description: Invalid input
 */
router.post(
  '/',
  authenticate,
  requirePermission('payments.create'),
  validate(createPaymentValidator),
  paymentController.createPayment.bind(paymentController)
);

/**
 * @swagger
 * /payments/{paymentId}/apply:
 *   post:
 *     summary: Apply payment to invoices
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - allocations
 *             properties:
 *               allocations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     invoiceId:
 *                       type: integer
 *                     amount:
 *                       type: number
 *     responses:
 *       200:
 *         description: Payment applied
 *       404:
 *         description: Payment not found
 */
router.post(
  '/:paymentId/apply',
  authenticate,
  requirePermission('payments.update'),
  validate([...paymentIdValidator, ...applyPaymentValidator]),
  paymentController.applyPayment.bind(paymentController)
);

/**
 * @swagger
 * /payments/{paymentId}/void:
 *   patch:
 *     summary: Void payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment voided
 *       400:
 *         description: Cannot void payment
 *       404:
 *         description: Payment not found
 */
router.patch(
  '/:paymentId/void',
  authenticate,
  requirePermission('payments.update'),
  validate([...paymentIdValidator, ...voidPaymentValidator]),
  paymentController.voidPayment.bind(paymentController)
);

export default router;