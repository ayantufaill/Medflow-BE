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

router.get(
  '/',
  authenticate,
  requirePermission('invoices.read'),
  validate(estimateSearchValidator),
  estimateController.getAllEstimates.bind(estimateController)
);

router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('invoices.read'),
  validate(patientIdValidator),
  estimateController.getEstimatesByPatient.bind(estimateController)
);

router.get(
  '/:estimateId',
  authenticate,
  requirePermission('invoices.read'),
  validate(estimateIdValidator),
  estimateController.getEstimateById.bind(estimateController)
);

router.post(
  '/',
  authenticate,
  requirePermission('invoices.create'),
  validate(createEstimateValidator),
  estimateController.createEstimate.bind(estimateController)
);

router.patch(
  '/:estimateId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...estimateIdValidator, ...updateEstimateValidator]),
  estimateController.updateEstimate.bind(estimateController)
);

router.delete(
  '/:estimateId',
  authenticate,
  requirePermission('invoices.delete'),
  validate(estimateIdValidator),
  estimateController.deleteEstimate.bind(estimateController)
);

router.post(
  '/:estimateId/convert',
  authenticate,
  requirePermission('invoices.create'),
  validate([...estimateIdValidator, ...convertEstimateValidator]),
  estimateController.convertToInvoice.bind(estimateController)
);

router.post(
  '/:estimateId/send',
  authenticate,
  requirePermission('invoices.update'),
  validate(estimateIdValidator),
  estimateController.sendToPatient.bind(estimateController)
);

router.patch(
  '/:estimateId/accept',
  authenticate,
  requirePermission('invoices.update'),
  validate(estimateIdValidator),
  estimateController.acceptEstimate.bind(estimateController)
);

router.patch(
  '/:estimateId/decline',
  authenticate,
  requirePermission('invoices.update'),
  validate([...estimateIdValidator, ...declineEstimateValidator]),
  estimateController.declineEstimate.bind(estimateController)
);

router.patch(
  '/:estimateId/expire',
  authenticate,
  requirePermission('invoices.update'),
  validate(estimateIdValidator),
  estimateController.expireEstimate.bind(estimateController)
);

export default router;
