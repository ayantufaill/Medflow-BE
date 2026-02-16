import { Router } from 'express';
import { claimController } from '../controllers/claim.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { uploadDocument as uploadDocumentMiddleware } from '../middleware/upload.middleware';
import {
  claimIdValidator,
  invoiceIdParamValidator,
  claimDocumentIdValidator,
  claimSearchValidator,
  createClaimFromInvoiceValidator,
  updateClaimValidator,
  resubmitClaimValidator,
} from '../validators/claim.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('claims.read'),
  validate(claimSearchValidator),
  claimController.getAllClaims.bind(claimController)
);

router.get(
  '/:claimId',
  authenticate,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClaimById.bind(claimController)
);

router.post(
  '/from-invoice/:invoiceId',
  authenticate,
  requirePermission('claims.create'),
  validate([...invoiceIdParamValidator, ...createClaimFromInvoiceValidator]),
  claimController.createClaimFromInvoice.bind(claimController)
);

router.patch(
  '/:claimId',
  authenticate,
  requirePermission('claims.update'),
  validate([...claimIdValidator, ...updateClaimValidator]),
  claimController.updateClaim.bind(claimController)
);

router.post(
  '/:claimId/validate',
  authenticate,
  requirePermission('claims.process'),
  validate(claimIdValidator),
  claimController.validateClaim.bind(claimController)
);

router.post(
  '/:claimId/submit',
  authenticate,
  requirePermission('claims.process'),
  validate(claimIdValidator),
  claimController.submitClaim.bind(claimController)
);

router.get(
  '/:claimId/status-history',
  authenticate,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClaimStatusHistory.bind(claimController)
);

router.post(
  '/:claimId/resubmit',
  authenticate,
  requirePermission('claims.update'),
  validate([...claimIdValidator, ...resubmitClaimValidator]),
  claimController.resubmitClaim.bind(claimController)
);

router.post(
  '/:claimId/documents',
  authenticate,
  requirePermission('claims.update'),
  validate(claimIdValidator),
  uploadDocumentMiddleware.any(),
  claimController.attachDocument.bind(claimController)
);

router.get(
  '/:claimId/documents',
  authenticate,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClaimDocuments.bind(claimController)
);

router.delete(
  '/:claimId/documents/:documentId',
  authenticate,
  requirePermission('claims.update'),
  validate([...claimIdValidator, ...claimDocumentIdValidator]),
  claimController.removeClaimDocument.bind(claimController)
);

export default router;
