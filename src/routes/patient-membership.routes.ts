import { Router } from 'express';
import { patientMembershipController } from '../controllers/patient-membership.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { patientIdValidator } from '../validators/patient.validator';

const router = Router();
router.use(authenticate);

router.get(
  '/:patientId/memberships',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(patientIdValidator),
  patientMembershipController.getPatientMemberships.bind(patientMembershipController)
);

router.post(
  '/:patientId/memberships',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(patientIdValidator),
  patientMembershipController.createPatientMembership.bind(patientMembershipController)
);

router.delete(
  '/:patientId/memberships/:membershipId',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(patientIdValidator),
  patientMembershipController.deletePatientMembership.bind(patientMembershipController)
);

export default router;
