import { Router } from 'express';
import { body } from 'express-validator';
import { recurringAppointmentController } from '../controllers/recurring-appointment.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  recurringAppointmentIdValidator,
  createRecurringAppointmentValidator,
  updateRecurringAppointmentValidator,
  generateAppointmentsValidator,
  recurringAppointmentQueryValidator,
} from '../validators/recurring-appointment.validator';

const router = Router();

// All recurring appointment routes require authentication
router.use(authenticate);

// Get all recurring appointments
router.get(
  '/',
  validate(recurringAppointmentQueryValidator),
  recurringAppointmentController.getAllRecurringAppointments.bind(recurringAppointmentController)
);

// Get recurring appointment by ID
router.get(
  '/:recurringAppointmentId',
  validate(recurringAppointmentIdValidator),
  recurringAppointmentController.getRecurringAppointmentById.bind(recurringAppointmentController)
);

// Preview recurring appointment series (before creating)
// Front Desk, Admin can preview recurring appointments
// Note: patientId is optional for preview
router.post(
  '/preview',
  requireRoles('Front Desk', 'Admin'),
  validate([
    body('providerId')
      .notEmpty()
      .withMessage('Provider ID is required')
      .isInt({ min: 1 })
      .withMessage('Invalid provider ID format'),
    body('appointmentTypeId')
      .notEmpty()
      .withMessage('Appointment type ID is required')
      .isInt({ min: 1 })
      .withMessage('Invalid appointment type ID format'),
    body('frequency')
      .notEmpty()
      .withMessage('Frequency is required')
      .isIn(['weekly', 'monthly', 'quarterly'])
      .withMessage('Frequency must be one of: weekly, monthly, quarterly'),
    body('frequencyValue')
      .notEmpty()
      .withMessage('Frequency value is required')
      .isInt({ min: 1, max: 52 })
      .withMessage('Frequency value must be between 1 and 52'),
    body('startDate')
      .notEmpty()
      .withMessage('Start date is required')
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    body('preferredTime')
      .notEmpty()
      .withMessage('Preferred time is required')
      .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Preferred time must be in HH:MM format (24-hour)'),
    body('preferredDayOfWeek')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage('Preferred day of week must be between 0 (Sunday) and 6 (Saturday)'),
    body('totalAppointments')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Total appointments must be between 1 and 100'),
  ]),
  recurringAppointmentController.previewRecurringAppointments.bind(recurringAppointmentController)
);

// Create recurring appointment series
// Front Desk, Admin can create recurring appointments
router.post(
  '/',
  requireRoles('Front Desk', 'Admin'),
  validate(createRecurringAppointmentValidator),
  recurringAppointmentController.createRecurringAppointment.bind(recurringAppointmentController)
);

// Create recurring appointment with conflict resolution
// Front Desk, Admin can create recurring appointments with overrides
router.post(
  '/with-resolution',
  requireRoles('Front Desk', 'Admin'),
  validate([
    ...createRecurringAppointmentValidator,
    body('appointmentOverrides')
      .optional()
      .isArray()
      .withMessage('appointmentOverrides must be an array'),
    body('appointmentOverrides.*.appointmentNumber')
      .optional()
      .isInt({ min: 1 })
      .withMessage('appointmentNumber must be a positive integer'),
    body('appointmentOverrides.*.skip')
      .optional()
      .isBoolean()
      .withMessage('skip must be a boolean'),
    body('appointmentOverrides.*.customDate')
      .optional()
      .isISO8601()
      .withMessage('customDate must be a valid ISO 8601 date'),
    body('appointmentOverrides.*.customStartTime')
      .optional()
      .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('customStartTime must be in HH:MM format'),
    body('appointmentOverrides.*.customEndTime')
      .optional()
      .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('customEndTime must be in HH:MM format'),
  ]),
  recurringAppointmentController.createRecurringAppointmentWithResolution.bind(recurringAppointmentController)
);

// Generate appointments from recurring series
// Front Desk, Admin can generate appointments
router.post(
  '/:recurringAppointmentId/generate',
  requireRoles('Front Desk', 'Admin'),
  validate([...recurringAppointmentIdValidator, ...generateAppointmentsValidator]),
  recurringAppointmentController.generateAppointments.bind(recurringAppointmentController)
);

// Update recurring appointment
// Front Desk, Admin can update recurring appointments
router.put(
  '/:recurringAppointmentId',
  requireRoles('Front Desk', 'Admin'),
  validate([...recurringAppointmentIdValidator, ...updateRecurringAppointmentValidator]),
  recurringAppointmentController.updateRecurringAppointment.bind(recurringAppointmentController)
);

// Get linked appointments for a recurring appointment
router.get(
  '/:recurringAppointmentId/appointments',
  validate(recurringAppointmentIdValidator),
  recurringAppointmentController.getLinkedAppointments.bind(recurringAppointmentController)
);

// Delete recurring appointment (Admin only)
router.delete(
  '/:recurringAppointmentId',
  requireRoles('Admin'),
  validate(recurringAppointmentIdValidator),
  recurringAppointmentController.deleteRecurringAppointment.bind(recurringAppointmentController)
);

export default router;
