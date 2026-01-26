import { Router } from 'express';
import { vitalSignController } from '../controllers/vital-sign.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  vitalSignIdValidator,
  patientIdParamValidator,
  appointmentIdParamValidator,
  createVitalSignValidator,
  updateVitalSignValidator,
  vitalSignQueryValidator,
  paginationQueryValidator,
} from '../validators/vital-sign.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(vitalSignQueryValidator),
  vitalSignController.getAllVitalSigns
);

router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('vital-signs.read'),
  validate([...patientIdParamValidator, ...paginationQueryValidator]),
  vitalSignController.getVitalSignsByPatient
);

router.get(
  '/patient/:patientId/latest',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(patientIdParamValidator),
  vitalSignController.getLatestVitalsByPatient
);

router.get(
  '/patient/:patientId/trend',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(patientIdParamValidator),
  vitalSignController.getVitalsTrend
);

router.get(
  '/appointment/:appointmentId',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(appointmentIdParamValidator),
  vitalSignController.getVitalSignByAppointment
);

router.get(
  '/:vitalSignId',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(vitalSignIdValidator),
  vitalSignController.getVitalSignById
);

router.post(
  '/',
  authenticate,
  requirePermission('vital-signs.create'),
  validate(createVitalSignValidator),
  vitalSignController.createVitalSign
);

router.put(
  '/:vitalSignId',
  authenticate,
  requirePermission('vital-signs.update'),
  validate([...vitalSignIdValidator, ...updateVitalSignValidator]),
  vitalSignController.updateVitalSign
);

router.delete(
  '/:vitalSignId',
  authenticate,
  requirePermission('vital-signs.delete'),
  validate(vitalSignIdValidator),
  vitalSignController.deleteVitalSign
);

export default router;
