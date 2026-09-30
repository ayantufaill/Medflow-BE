import { Router } from 'express';
import { paymentTerminalController } from '../controllers/payment-terminal.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  idParamValidator,
  createTerminalValidator,
} from '../validators/payment-terminal.validator';

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate, resolveBranchAccess, enterTenantContext);

router.get(
  '/',
  paymentTerminalController.listTerminals.bind(paymentTerminalController)
);

router.post(
  '/',
  validate(createTerminalValidator),
  paymentTerminalController.createTerminal.bind(paymentTerminalController)
);

router.delete(
  '/:id',
  validate(idParamValidator),
  paymentTerminalController.deleteTerminal.bind(paymentTerminalController)
);

export default router;
