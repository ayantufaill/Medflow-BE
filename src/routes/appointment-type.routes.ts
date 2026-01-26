import { Router } from 'express';
import { appointmentTypeController } from '../controllers/appointment-type.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  appointmentTypeIdValidator,
  createAppointmentTypeValidator,
  updateAppointmentTypeValidator,
  appointmentTypeQueryValidator,
} from '../validators/appointment-type.validator';

const router = Router();

// All appointment type routes require authentication
router.use(authenticate);

// Get all appointment types
router.get(
  '/',
  validate(appointmentTypeQueryValidator),
  appointmentTypeController.getAllAppointmentTypes.bind(appointmentTypeController)
);

// Get appointment type by ID
router.get(
  '/:appointmentTypeId',
  validate(appointmentTypeIdValidator),
  appointmentTypeController.getAppointmentTypeById.bind(appointmentTypeController)
);

// Create appointment type (Admin only)
router.post(
  '/',
  requireRoles('Admin'),
  validate(createAppointmentTypeValidator),
  appointmentTypeController.createAppointmentType.bind(appointmentTypeController)
);

// Update appointment type (Admin only)
router.put(
  '/:appointmentTypeId',
  requireRoles('Admin'),
  validate([...appointmentTypeIdValidator, ...updateAppointmentTypeValidator]),
  appointmentTypeController.updateAppointmentType.bind(appointmentTypeController)
);

// Delete appointment type (Admin only)
router.delete(
  '/:appointmentTypeId',
  requireRoles('Admin'),
  validate(appointmentTypeIdValidator),
  appointmentTypeController.deleteAppointmentType.bind(appointmentTypeController)
);

export default router;
