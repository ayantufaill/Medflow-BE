import { Router } from 'express';
import { patientMembershipController } from '../controllers/patient-membership.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePhiAccess } from '../middleware/phi.middleware';
import { validate } from '../middleware/validation.middleware';
import { patientIdValidator } from '../validators/patient.validator';

const router = Router();
router.use(authenticate, requirePhiAccess, resolveBranchAccess, enterTenantContext);

router.get(
  '/:patientId/memberships',
  requirePermission('insurance.read'),
  validate(patientIdValidator),
  patientMembershipController.getPatientMemberships.bind(patientMembershipController)
);

router.post(
  '/:patientId/memberships',
  requirePermission('insurance.create'),
  validate(patientIdValidator),
  patientMembershipController.createPatientMembership.bind(patientMembershipController)
);

router.delete(
  '/:patientId/memberships/:membershipId',
  requirePermission('insurance.delete'),
  validate(patientIdValidator),
  patientMembershipController.deletePatientMembership.bind(patientMembershipController)
);

export default router;
