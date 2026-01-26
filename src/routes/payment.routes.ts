import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  paymentIdValidator,
  paymentSearchValidator,
  createPaymentValidator,
  applyPaymentValidator,
} from '../validators/payment.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('payments.read'),
  validate(paymentSearchValidator),
  paymentController.getAllPayments.bind(paymentController)
);

router.get(
  '/:paymentId',
  authenticate,
  requirePermission('payments.read'),
  validate(paymentIdValidator),
  paymentController.getPaymentById.bind(paymentController)
);

router.post(
  '/',
  authenticate,
  requirePermission('payments.create'),
  validate(createPaymentValidator),
  paymentController.createPayment.bind(paymentController)
);

router.post(
  '/:paymentId/apply',
  authenticate,
  requirePermission('payments.update'),
  validate([...paymentIdValidator, ...applyPaymentValidator]),
  paymentController.applyPayment.bind(paymentController)
);

export default router;
