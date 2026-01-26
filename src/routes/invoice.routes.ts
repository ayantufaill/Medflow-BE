import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  invoiceIdValidator,
  invoiceItemIdValidator,
  appointmentIdParamValidator,
  invoiceSearchValidator,
  createInvoiceFromAppointmentValidator,
  updateInvoiceValidator,
  createInvoiceItemValidator,
  updateInvoiceItemValidator,
  recalculateInvoiceValidator,
} from '../validators/invoice.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('invoices.read'),
  validate(invoiceSearchValidator),
  invoiceController.getAllInvoices.bind(invoiceController)
);

router.get(
  '/:invoiceId',
  authenticate,
  requirePermission('invoices.read'),
  validate(invoiceIdValidator),
  invoiceController.getInvoiceById.bind(invoiceController)
);

router.post(
  '/from-appointment/:appointmentId',
  authenticate,
  requirePermission('invoices.create'),
  validate([...appointmentIdParamValidator, ...createInvoiceFromAppointmentValidator]),
  invoiceController.createInvoiceFromAppointment.bind(invoiceController)
);

router.patch(
  '/:invoiceId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...updateInvoiceValidator]),
  invoiceController.updateInvoice.bind(invoiceController)
);

router.delete(
  '/:invoiceId',
  authenticate,
  requirePermission('invoices.delete'),
  validate(invoiceIdValidator),
  invoiceController.deleteInvoice.bind(invoiceController)
);

router.post(
  '/:invoiceId/items',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...createInvoiceItemValidator]),
  invoiceController.addInvoiceItem.bind(invoiceController)
);

router.patch(
  '/:invoiceId/items/:itemId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...invoiceItemIdValidator, ...updateInvoiceItemValidator]),
  invoiceController.updateInvoiceItem.bind(invoiceController)
);

router.delete(
  '/:invoiceId/items/:itemId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...invoiceItemIdValidator]),
  invoiceController.deleteInvoiceItem.bind(invoiceController)
);

router.post(
  '/:invoiceId/recalculate',
  authenticate,
  requirePermission('invoices.update'),
  validate([...invoiceIdValidator, ...recalculateInvoiceValidator]),
  invoiceController.recalculateInvoice.bind(invoiceController)
);

export default router;
