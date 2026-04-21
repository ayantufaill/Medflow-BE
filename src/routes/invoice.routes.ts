import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  invoiceIdValidator,
  invoiceItemIdValidator,
  appointmentIdParamValidator,
  patientIdParamValidator,
  invoiceSearchValidator,
  createInvoiceFromAppointmentValidator,
  updateInvoiceValidator,
  createInvoiceItemValidator,
  updateInvoiceItemValidator,
  recalculateInvoiceValidator,
  voidInvoiceValidator,
} from '../validators/invoice.validator';

const router = Router();

/**
 * @swagger
 * /invoices:
 *   get:
 *     summary: Get all invoices
 *     tags: [Invoices]
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
 *         name: status
 *         schema: { type: string, enum: [draft, final, paid, void] }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: List of invoices
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  requirePermission('invoices.read'),
  validate(invoiceSearchValidator),
  invoiceController.getAllInvoices.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/patient/{patientId}:
 *   get:
 *     summary: Get invoices by patient ID
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of patient invoices
 *       404:
 *         description: Patient not found
 */
router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('invoices.read'),
  validate(patientIdParamValidator),
  invoiceController.getInvoicesByPatient.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/patient/{patientId}/balance:
 *   get:
 *     summary: Get patient balance
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Patient balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     patientId:
 *                       type: integer
 *                     totalDue:
 *                       type: number
 *                     totalPaid:
 *                       type: number
 *                     balance:
 *                       type: number
 */
router.get(
  '/patient/:patientId/balance',
  authenticate,
  requirePermission('invoices.read'),
  validate(patientIdParamValidator),
  invoiceController.getPatientBalance.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/{invoiceId}:
 *   get:
 *     summary: Get invoice by ID
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Invoice details
 *       404:
 *         description: Invoice not found
 */
router.get(
  '/:invoiceId',
  authenticate,
  requirePermission('invoices.read'),
  validate(invoiceIdValidator),
  invoiceController.getInvoiceById.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/from-appointment/{appointmentId}:
 *   post:
 *     summary: Create invoice from appointment
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               includeProcedures:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Invoice created from appointment
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Invoice already exists for this appointment
 */
router.post(
  '/from-appointment/:appointmentId',
  authenticate,
  requirePermission('invoices.create'),
  validate([...appointmentIdParamValidator, ...createInvoiceFromAppointmentValidator]),
  invoiceController.createInvoiceFromAppointment.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/{invoiceId}:
 *   patch:
 *     summary: Update invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               discount:
 *                 type: number
 *               discountReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invoice updated
 *       404:
 *         description: Invoice not found
 */
router.patch(
  '/:invoiceId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...updateInvoiceValidator]),
  invoiceController.updateInvoice.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/{invoiceId}:
 *   delete:
 *     summary: Delete invoice (soft delete)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Invoice deleted
 *       403:
 *         description: Cannot delete finalized invoice
 *       404:
 *         description: Invoice not found
 */
router.delete(
  '/:invoiceId',
  authenticate,
  requirePermission('invoices.delete'),
  validate(invoiceIdValidator),
  invoiceController.deleteInvoice.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/{invoiceId}/items:
 *   post:
 *     summary: Add item to invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - amount
 *             properties:
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *               quantity:
 *                 type: integer
 *                 default: 1
 *               procedureId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Item added to invoice
 *       400:
 *         description: Cannot add items to finalized invoice
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/:invoiceId/items',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...createInvoiceItemValidator]),
  invoiceController.addInvoiceItem.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/{invoiceId}/items/{itemId}:
 *   patch:
 *     summary: Update invoice item
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: itemId
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
 *               amount:
 *                 type: number
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Invoice item updated
 *       404:
 *         description: Invoice or item not found
 */
router.patch(
  '/:invoiceId/items/:itemId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...invoiceItemIdValidator, ...updateInvoiceItemValidator]),
  invoiceController.updateInvoiceItem.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/{invoiceId}/items/{itemId}:
 *   delete:
 *     summary: Delete invoice item
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Invoice item deleted
 *       404:
 *         description: Invoice or item not found
 */
router.delete(
  '/:invoiceId/items/:itemId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...invoiceItemIdValidator]),
  invoiceController.deleteInvoiceItem.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/{invoiceId}/recalculate:
 *   post:
 *     summary: Recalculate invoice totals
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               discount:
 *                 type: number
 *               tax:
 *                 type: number
 *     responses:
 *       200:
 *         description: Invoice recalculated
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/:invoiceId/recalculate',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...recalculateInvoiceValidator]),
  invoiceController.recalculateInvoice.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/{invoiceId}/finalize:
 *   patch:
 *     summary: Finalize invoice (cannot be edited after)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Invoice finalized
 *       400:
 *         description: Invoice already finalized
 *       404:
 *         description: Invoice not found
 */
router.patch(
  '/:invoiceId/finalize',
  authenticate,
  requirePermission('invoices.update'),
  validate(invoiceIdValidator),
  invoiceController.finalizeInvoice.bind(invoiceController)
);

/**
 * @swagger
 * /invoices/{invoiceId}/void:
 *   patch:
 *     summary: Void invoice
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
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
 *         description: Invoice voided
 *       400:
 *         description: Cannot void paid invoice
 *       404:
 *         description: Invoice not found
 */
router.patch(
  '/:invoiceId/void',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...voidInvoiceValidator]),
  invoiceController.voidInvoice.bind(invoiceController)
);

export default router;