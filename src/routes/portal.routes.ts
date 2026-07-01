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

/**
 * @swagger
 * /portal/me:
 *   get:
 *     summary: Get patient profile
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient profile
 *       403:
 *         description: Patient role required
 */
router.get('/me', requireRoles('Patient'), portalController.getMyProfile.bind(portalController));

/**
 * @swagger
 * /portal/me/profile:
 *   put:
 *     summary: Update patient profile
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put(
  '/me/profile',
  requireRoles('Patient'),
  validate(portalProfileUpdateValidator),
  portalController.updateMyProfile.bind(portalController)
);

/**
 * @swagger
 * /portal/appointments:
 *   get:
 *     summary: Get patient appointments
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [scheduled, completed, cancelled] }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: List of appointments
 */
router.get(
  '/appointments',
  requireRoles('Patient'),
  validate(portalAppointmentQueryValidator),
  portalController.getMyAppointments.bind(portalController)
);

/**
 * @swagger
 * /portal/appointments/providers:
 *   get:
 *     summary: Get providers for booking
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of providers
 */
router.get(
  '/appointments/providers',
  requireRoles('Patient'),
  portalController.getProviders.bind(portalController)
);

/**
 * @swagger
 * /portal/appointments/available-slots:
 *   get:
 *     summary: Get available appointment slots
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Available time slots
 */
router.get(
  '/appointments/available-slots',
  requireRoles('Patient'),
  validate(portalSlotsQueryValidator),
  portalController.getAvailableSlots.bind(portalController)
);

/**
 * @swagger
 * /portal/appointments:
 *   post:
 *     summary: Book an appointment
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - providerId
 *               - startTime
 *             properties:
 *               providerId:
 *                 type: integer
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               appointmentTypeId:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment booked
 */
router.post(
  '/appointments',
  requireRoles('Patient'),
  validate(portalBookAppointmentValidator),
  portalController.bookAppointment.bind(portalController)
);

/**
 * @swagger
 * /portal/appointments/{appointmentId}:
 *   get:
 *     summary: Get appointment by ID
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Appointment details
 */
router.get(
  '/appointments/:appointmentId',
  requireRoles('Patient'),
  validate(portalAppointmentIdValidator),
  portalController.getMyAppointmentById.bind(portalController)
);

/**
 * @swagger
 * /portal/appointments/{appointmentId}/reschedule:
 *   post:
 *     summary: Reschedule an appointment
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newStartTime
 *             properties:
 *               newStartTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Appointment rescheduled
 */
router.post(
  '/appointments/:appointmentId/reschedule',
  requireRoles('Patient'),
  validate([...portalAppointmentIdValidator, ...portalRescheduleAppointmentValidator]),
  portalController.rescheduleAppointment.bind(portalController)
);

/**
 * @swagger
 * /portal/appointments/{appointmentId}/cancel:
 *   post:
 *     summary: Cancel an appointment
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment cancelled
 */
router.post(
  '/appointments/:appointmentId/cancel',
  requireRoles('Patient'),
  validate([...portalAppointmentIdValidator, ...portalCancelAppointmentValidator]),
  portalController.cancelAppointment.bind(portalController)
);

/**
 * @swagger
 * /portal/messages/threads:
 *   get:
 *     summary: Get message threads
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of message threads
 */
router.get(
  '/messages/threads',
  requireRoles('Patient'),
  portalController.getMessageThreads.bind(portalController)
);

/**
 * @swagger
 * /portal/messages/threads/{threadId}:
 *   get:
 *     summary: Get thread messages
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Thread messages
 */
router.get(
  '/messages/threads/:threadId',
  requireRoles('Patient'),
  validate(portalThreadIdValidator),
  portalController.getThreadMessages.bind(portalController)
);

/**
 * @swagger
 * /portal/messages:
 *   post:
 *     summary: Send a message
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - message
 *             properties:
 *               recipientId:
 *                 type: integer
 *               message:
 *                 type: string
 *               subject:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent
 */
router.post(
  '/messages',
  requireRoles('Patient'),
  validate(portalSendMessageValidator),
  portalController.sendMessage.bind(portalController)
);

/**
 * @swagger
 * /portal/forms:
 *   get:
 *     summary: Get patient forms
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of forms
 */
router.get(
  '/forms',
  requireRoles('Patient'),
  validate(portalPaginationValidator),
  portalController.getMyForms.bind(portalController)
);

/**
 * @swagger
 * /portal/forms/pending:
 *   get:
 *     summary: Get pending forms
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending forms
 */
router.get('/forms/pending', requireRoles('Patient'), portalController.getPendingForms.bind(portalController));

/**
 * @swagger
 * /portal/forms/{formId}:
 *   get:
 *     summary: Get form by ID
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Form details
 */
router.get(
  '/forms/:formId',
  requireRoles('Patient'),
  validate(portalFormIdValidator),
  portalController.getMyFormById.bind(portalController)
);

/**
 * @swagger
 * /portal/forms:
 *   post:
 *     summary: Submit a form
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - formType
 *             properties:
 *               formType:
 *                 type: string
 *               responses:
 *                 type: object
 *     responses:
 *       201:
 *         description: Form submitted
 */
router.post(
  '/forms',
  requireRoles('Patient'),
  validate(portalSubmitFormValidator),
  portalController.submitForm.bind(portalController)
);

/**
 * @swagger
 * /portal/forms/{formId}:
 *   put:
 *     summary: Update a form
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               responses:
 *                 type: object
 *     responses:
 *       200:
 *         description: Form updated
 */
router.put(
  '/forms/:formId',
  requireRoles('Patient'),
  validate([...portalFormIdValidator, ...portalUpdateFormValidator]),
  portalController.updateMyForm.bind(portalController)
);

/**
 * @swagger
 * /portal/notifications:
 *   get:
 *     summary: Get notifications
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get(
  '/notifications',
  requireRoles('Patient'),
  validate(portalPaginationValidator),
  portalController.getNotifications.bind(portalController)
);

/**
 * @swagger
 * /portal/notifications/{notificationId}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.post(
  '/notifications/:notificationId/read',
  requireRoles('Patient'),
  validate(portalNotificationIdValidator),
  portalController.markNotificationRead.bind(portalController)
);

/**
 * @swagger
 * /portal/notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences
 */
router.get(
  '/notifications/preferences',
  requireRoles('Patient'),
  portalController.getNotificationPreferences.bind(portalController)
);

/**
 * @swagger
 * /portal/notifications/preferences:
 *   put:
 *     summary: Update notification preferences
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: boolean
 *               sms:
 *                 type: boolean
 *               push:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated
 */
router.put(
  '/notifications/preferences',
  requireRoles('Patient'),
  validate(portalNotificationPreferencesValidator),
  portalController.updateNotificationPreferences.bind(portalController)
);

/**
 * @swagger
 * /portal/provider/messages/threads:
 *   get:
 *     summary: Get provider message threads (Provider/Admin only)
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of provider message threads
 */
router.get(
  '/provider/messages/threads',
  requireRoles('Provider', 'Doctor', 'Admin'),
  portalController.getProviderMessageThreads.bind(portalController)
);

/**
 * @swagger
 * /portal/provider/messages/threads/{threadId}:
 *   get:
 *     summary: Get provider thread messages
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Thread messages
 */
router.get(
  '/provider/messages/threads/:threadId',
  requireRoles('Provider', 'Doctor', 'Admin'),
  validate(portalThreadIdValidator),
  portalController.getProviderThreadMessages.bind(portalController)
);

/**
 * @swagger
 * /portal/provider/patients/{patientId}/context:
 *   get:
 *     summary: Get patient context for provider
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Patient context data
 */
router.get(
  '/provider/patients/:patientId/context',
  requireRoles('Provider', 'Doctor', 'Admin'),
  validate(portalProviderPatientIdValidator),
  portalController.getProviderPatientContext.bind(portalController)
);

/**
 * @swagger
 * /portal/provider/messages/reply:
 *   post:
 *     summary: Reply to provider thread
 *     tags: [Patient Portal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - threadId
 *               - message
 *             properties:
 *               threadId:
 *                 type: integer
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reply sent
 */
router.post(
  '/provider/messages/reply',
  requireRoles('Provider', 'Doctor', 'Admin'),
  validate(portalProviderReplyValidator),
  portalController.replyToProviderThread.bind(portalController)
);

export default router;