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
} from '../validators/estimate.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('invoices.read'),
  validate(estimateSearchValidator),
  estimateController.getAllEstimates.bind(estimateController)
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

export default router;
