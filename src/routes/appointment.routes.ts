import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  appointmentIdValidator,
  providerIdValidator,
  createAppointmentValidator,
  updateAppointmentValidator,
  rescheduleAppointmentValidator,
  cancelAppointmentValidator,
  appointmentQueryValidator,
  scheduleQueryValidator,
  availableSlotsQueryValidator,
  appointmentWorkspaceValidator,
  appointmentProcedureValidator,
  appointmentTagValidator,
  appointmentLabOrderValidator,
  appointmentCommunicationValidator,
} from '../validators/appointment.validator';

const router = Router();

// All appointment routes require authentication
router.use(authenticate);

// Get all appointments (with filters)
router.get(
  '/',
  validate(appointmentQueryValidator),
  appointmentController.getAllAppointments.bind(appointmentController)
);

// Get calendar schedule (multiple providers)
// Front Desk, Admin, Doctor can view calendar
router.get(
  '/calendar',
  requireRoles('Front Desk', 'Admin', 'Doctor'),
  appointmentController.getCalendarSchedule.bind(appointmentController)
);

// Get appointment by ID
router.get(
  '/:appointmentId',
  validate(appointmentIdValidator),
  appointmentController.getAppointmentById.bind(appointmentController)
);

router.get(
  '/:appointmentId/workspace',
  validate(appointmentIdValidator),
  appointmentController.getAppointmentWorkspace.bind(appointmentController)
);

router.patch(
  '/:appointmentId/workspace',
  requireRoles('Front Desk', 'Admin'),
  validate([...appointmentIdValidator, ...appointmentWorkspaceValidator]),
  appointmentController.updateAppointmentWorkspace.bind(appointmentController)
);

router.get(
  '/:appointmentId/procedures',
  validate(appointmentIdValidator),
  appointmentController.getAppointmentProcedures.bind(appointmentController)
);

router.post(
  '/:appointmentId/procedures',
  requireRoles('Front Desk', 'Admin'),
  validate([...appointmentIdValidator, ...appointmentProcedureValidator]),
  appointmentController.addAppointmentProcedure.bind(appointmentController)
);

router.get(
  '/:appointmentId/tags',
  validate(appointmentIdValidator),
  appointmentController.getAppointmentTags.bind(appointmentController)
);

router.post(
  '/:appointmentId/tags',
  requireRoles('Front Desk', 'Admin'),
  validate([...appointmentIdValidator, ...appointmentTagValidator]),
  appointmentController.addAppointmentTag.bind(appointmentController)
);

router.post(
  '/:appointmentId/lab-orders',
  requireRoles('Front Desk', 'Admin'),
  validate([...appointmentIdValidator, ...appointmentLabOrderValidator]),
  appointmentController.addAppointmentLabOrder.bind(appointmentController)
);

router.post(
  '/:appointmentId/communications/send',
  requireRoles('Front Desk', 'Admin'),
  validate([...appointmentIdValidator, ...appointmentCommunicationValidator]),
  appointmentController.createAppointmentCommunication.bind(appointmentController)
);

// Get provider schedule (day/week/month view)
// Front Desk, Admin, Doctor can view schedules
router.get(
  '/providers/:providerId/schedule',
  requireRoles('Front Desk', 'Admin', 'Doctor'),
  validate([...providerIdValidator, ...scheduleQueryValidator]),
  appointmentController.getProviderSchedule.bind(appointmentController)
);

// Get available time slots for a provider
// Front Desk, Admin can view available slots
router.get(
  '/providers/:providerId/available-slots',
  requireRoles('Front Desk', 'Admin'),
  validate([...providerIdValidator, ...availableSlotsQueryValidator]),
  appointmentController.getAvailableSlots.bind(appointmentController)
);

// Create new appointment
// Front Desk, Admin can create appointments
router.post(
  '/',
  requireRoles('Front Desk', 'Admin'),
  validate(createAppointmentValidator),
  appointmentController.createAppointment.bind(appointmentController)
);

// Update appointment
// Front Desk, Admin can update appointments
router.put(
  '/:appointmentId',
  requireRoles('Front Desk', 'Admin'),
  validate([...appointmentIdValidator, ...updateAppointmentValidator]),
  appointmentController.updateAppointment.bind(appointmentController)
);

// Cancel appointment
// Front Desk, Admin can cancel appointments
router.post(
  '/:appointmentId/cancel',
  requireRoles('Front Desk', 'Admin'),
  validate([...appointmentIdValidator, ...cancelAppointmentValidator]),
  appointmentController.cancelAppointment.bind(appointmentController)
);

// Reschedule appointment
// Front Desk, Admin can reschedule appointments
router.post(
  '/:appointmentId/reschedule',
  requireRoles('Front Desk', 'Admin'),
  validate([...appointmentIdValidator, ...rescheduleAppointmentValidator]),
  appointmentController.rescheduleAppointment.bind(appointmentController)
);

// Check-in patient
// Front Desk, Admin, Nursing can check in patients
router.post(
  '/:appointmentId/check-in',
  requireRoles('Front Desk', 'Admin', 'Nursing'),
  validate(appointmentIdValidator),
  appointmentController.checkInAppointment.bind(appointmentController)
);

router.post(
  '/:appointmentId/check-out',
  requireRoles('Front Desk', 'Admin', 'Nursing'),
  validate(appointmentIdValidator),
  appointmentController.checkOutAppointment.bind(appointmentController)
);

// Delete appointment (soft delete)
// Admin only
router.delete(
  '/:appointmentId',
  requireRoles('Admin'),
  validate(appointmentIdValidator),
  appointmentController.deleteAppointment.bind(appointmentController)
);

export default router;
