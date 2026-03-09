import { Router } from 'express';
import { insurancePlanController } from '../controllers/insurance-plan.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  coverageTemplatePayloadValidator,
  insurancePlanIdValidator,
  insurancePlanPayloadValidator,
  insurancePlanQueryValidator,
  insurancePlanUpdateValidator,
} from '../validators/insurance-plan.validator';
import { patientIdValidator } from '../validators/patient.validator';
import { createPatientInsuranceValidator } from '../validators/insurance.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(insurancePlanQueryValidator),
  insurancePlanController.getInsurancePlans.bind(insurancePlanController)
);

router.post(
  '/',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(insurancePlanPayloadValidator),
  insurancePlanController.createInsurancePlan.bind(insurancePlanController)
);

router.get(
  '/coverage-templates',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  insurancePlanController.getCoverageTemplates.bind(insurancePlanController)
);

router.post(
  '/coverage-templates',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(coverageTemplatePayloadValidator),
  insurancePlanController.createCoverageTemplate.bind(insurancePlanController)
);

router.get(
  '/:planId',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(insurancePlanIdValidator),
  insurancePlanController.getInsurancePlanById.bind(insurancePlanController)
);

router.patch(
  '/:planId',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate([...insurancePlanIdValidator, ...insurancePlanUpdateValidator]),
  insurancePlanController.updateInsurancePlan.bind(insurancePlanController)
);

router.get(
  '/patients/:patientId/coverages',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(patientIdValidator),
  insurancePlanController.getPatientCoverages.bind(insurancePlanController)
);

router.post(
  '/patients/:patientId/coverages',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate([...patientIdValidator, ...createPatientInsuranceValidator]),
  insurancePlanController.createPatientCoverage.bind(insurancePlanController)
);

export default router;
