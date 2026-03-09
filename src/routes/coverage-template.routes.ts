import { Router } from 'express';
import { insurancePlanController } from '../controllers/insurance-plan.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { coverageTemplatePayloadValidator } from '../validators/insurance-plan.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  insurancePlanController.getCoverageTemplates.bind(insurancePlanController)
);

router.post(
  '/',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(coverageTemplatePayloadValidator),
  insurancePlanController.createCoverageTemplate.bind(insurancePlanController)
);

export default router;
