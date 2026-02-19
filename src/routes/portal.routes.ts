import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { portalController } from '../controllers/portal.controller';
import {
  portalAppointmentIdValidator,
  portalAppointmentQueryValidator,
  portalBookAppointmentValidator,
  portalCancelAppointmentValidator,
  portalFormIdValidator,
  portalNotificationIdValidator,
  portalNotificationPreferencesValidator,
  portalPaginationValidator,
  portalProviderPatientIdValidator,
  portalProfileUpdateValidator,
  portalProviderReplyValidator,
  portalRescheduleAppointmentValidator,
  portalSendMessageValidator,
  portalSlotsQueryValidator,
  portalSubmitFormValidator,
  portalThreadIdValidator,
  portalUpdateFormValidator,
} from '../validators/portal.validator';

const router = Router();

router.use(authenticate);

router.get('/me', requireRoles('Patient'), portalController.getMyProfile.bind(portalController));
router.put(
  '/me/profile',
  requireRoles('Patient'),
  validate(portalProfileUpdateValidator),
  portalController.updateMyProfile.bind(portalController)
);

router.get(
  '/appointments',
  requireRoles('Patient'),
  validate(portalAppointmentQueryValidator),
  portalController.getMyAppointments.bind(portalController)
);
router.get(
  '/appointments/providers',
  requireRoles('Patient'),
  portalController.getProviders.bind(portalController)
);
router.get(
  '/appointments/available-slots',
  requireRoles('Patient'),
  validate(portalSlotsQueryValidator),
  portalController.getAvailableSlots.bind(portalController)
);
router.post(
  '/appointments',
  requireRoles('Patient'),
  validate(portalBookAppointmentValidator),
  portalController.bookAppointment.bind(portalController)
);
router.get(
  '/appointments/:appointmentId',
  requireRoles('Patient'),
  validate(portalAppointmentIdValidator),
  portalController.getMyAppointmentById.bind(portalController)
);
router.post(
  '/appointments/:appointmentId/reschedule',
  requireRoles('Patient'),
  validate([...portalAppointmentIdValidator, ...portalRescheduleAppointmentValidator]),
  portalController.rescheduleAppointment.bind(portalController)
);
router.post(
  '/appointments/:appointmentId/cancel',
  requireRoles('Patient'),
  validate([...portalAppointmentIdValidator, ...portalCancelAppointmentValidator]),
  portalController.cancelAppointment.bind(portalController)
);

router.get(
  '/messages/threads',
  requireRoles('Patient'),
  portalController.getMessageThreads.bind(portalController)
);
router.get(
  '/messages/threads/:threadId',
  requireRoles('Patient'),
  validate(portalThreadIdValidator),
  portalController.getThreadMessages.bind(portalController)
);
router.post(
  '/messages',
  requireRoles('Patient'),
  validate(portalSendMessageValidator),
  portalController.sendMessage.bind(portalController)
);

router.get(
  '/forms',
  requireRoles('Patient'),
  validate(portalPaginationValidator),
  portalController.getMyForms.bind(portalController)
);
router.get('/forms/pending', requireRoles('Patient'), portalController.getPendingForms.bind(portalController));
router.get(
  '/forms/:formId',
  requireRoles('Patient'),
  validate(portalFormIdValidator),
  portalController.getMyFormById.bind(portalController)
);
router.post(
  '/forms',
  requireRoles('Patient'),
  validate(portalSubmitFormValidator),
  portalController.submitForm.bind(portalController)
);
router.put(
  '/forms/:formId',
  requireRoles('Patient'),
  validate([...portalFormIdValidator, ...portalUpdateFormValidator]),
  portalController.updateMyForm.bind(portalController)
);

router.get(
  '/notifications',
  requireRoles('Patient'),
  validate(portalPaginationValidator),
  portalController.getNotifications.bind(portalController)
);
router.post(
  '/notifications/:notificationId/read',
  requireRoles('Patient'),
  validate(portalNotificationIdValidator),
  portalController.markNotificationRead.bind(portalController)
);
router.get(
  '/notifications/preferences',
  requireRoles('Patient'),
  portalController.getNotificationPreferences.bind(portalController)
);
router.put(
  '/notifications/preferences',
  requireRoles('Patient'),
  validate(portalNotificationPreferencesValidator),
  portalController.updateNotificationPreferences.bind(portalController)
);

router.get(
  '/provider/messages/threads',
  requireRoles('Provider', 'Doctor', 'Admin'),
  portalController.getProviderMessageThreads.bind(portalController)
);
router.get(
  '/provider/messages/threads/:threadId',
  requireRoles('Provider', 'Doctor', 'Admin'),
  validate(portalThreadIdValidator),
  portalController.getProviderThreadMessages.bind(portalController)
);
router.get(
  '/provider/patients/:patientId/context',
  requireRoles('Provider', 'Doctor', 'Admin'),
  validate(portalProviderPatientIdValidator),
  portalController.getProviderPatientContext.bind(portalController)
);
router.post(
  '/provider/messages/reply',
  requireRoles('Provider', 'Doctor', 'Admin'),
  validate(portalProviderReplyValidator),
  portalController.replyToProviderThread.bind(portalController)
);

export default router;
