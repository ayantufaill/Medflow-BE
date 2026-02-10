import { Router } from 'express';
import { authorizationController } from '../controllers/authorization.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  authorizationIdValidator,
  authorizationListValidator,
  createAuthorizationValidator,
  updateAuthorizationValidator,
} from '../validators/authorization.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('invoices.read'),
  validate(authorizationListValidator),
  authorizationController.getAllAuthorizations.bind(authorizationController)
);

router.get(
  '/:authorizationId',
  authenticate,
  requirePermission('invoices.read'),
  validate(authorizationIdValidator),
  authorizationController.getAuthorizationById.bind(authorizationController)
);

router.post(
  '/',
  authenticate,
  requirePermission('invoices.create'),
  validate(createAuthorizationValidator),
  authorizationController.requestAuthorization.bind(authorizationController)
);

router.patch(
  '/:authorizationId',
  authenticate,
  requirePermission('invoices.update'),
  validate([...authorizationIdValidator, ...updateAuthorizationValidator]),
  authorizationController.updateAuthorization.bind(authorizationController)
);

router.get(
  '/:authorizationId/status-history',
  authenticate,
  requirePermission('invoices.read'),
  validate(authorizationIdValidator),
  authorizationController.getStatusHistory.bind(authorizationController)
);

router.get(
  '/:authorizationId/print',
  authenticate,
  requirePermission('invoices.read'),
  validate(authorizationIdValidator),
  authorizationController.printAuthorizationForm.bind(authorizationController)
);

export default router;
