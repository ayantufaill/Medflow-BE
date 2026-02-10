import { Router } from 'express';
import { claimController } from '../controllers/claim.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { uploadClaimDocument } from '../middleware/upload.middleware';
import {
  claimIdValidator,
  invoiceIdValidator,
  claimListValidator,
  updateClaimValidator,
  createClaimFromInvoiceValidator,
} from '../validators/claim.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('invoices.read'),
  validate(claimListValidator),
  claimController.getAllClaims.bind(claimController)
);

router.get(
  '/:claimId',
  authenticate,
  requirePermission('invoices.read'),
  validate(claimIdValidator),
  claimController.getClaimById.bind(claimController)
);

router.post(
  '/from-invoice/:invoiceId',
  authenticate,
  requirePermission('invoices.create'),
  validate([...invoiceIdValidator, ...createClaimFromInvoiceValidator]),
  claimController.createClaimFromInvoice.bind(claimController)
);

router.patch(
  '/:claimId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...claimIdValidator, ...updateClaimValidator]),
  claimController.updateClaim.bind(claimController)
);

router.post(
  '/:claimId/validate',
  authenticate,
  requirePermission('invoices.read'),
  validate(claimIdValidator),
  claimController.validateClaim.bind(claimController)
);

router.post(
  '/:claimId/submit',
  authenticate,
  requirePermission('invoices.update'),
  validate(claimIdValidator),
  claimController.submitClaim.bind(claimController)
);

router.get(
  '/:claimId/status-history',
  authenticate,
  requirePermission('invoices.read'),
  validate(claimIdValidator),
  claimController.getClaimStatusHistory.bind(claimController)
);

router.post(
  '/:claimId/resubmit',
  authenticate,
  requirePermission('invoices.update'),
  validate(claimIdValidator),
  claimController.resubmitClaim.bind(claimController)
);

router.get(
  '/:claimId/documents',
  authenticate,
  requirePermission('invoices.read'),
  validate(claimIdValidator),
  claimController.getClaimDocuments.bind(claimController)
);

router.post(
  '/:claimId/documents',
  authenticate,
  requirePermission('invoices.update'),
  validate(claimIdValidator),
  uploadClaimDocument.single('file'),
  claimController.attachDocument.bind(claimController)
);

router.delete(
  '/:claimId/documents/:documentId',
  authenticate,
  requirePermission('invoices.update'),
  validate(claimIdValidator),
  claimController.removeClaimDocument.bind(claimController)
);

export default router;
