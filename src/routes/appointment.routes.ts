import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  appointmentIdValidator, providerIdValidator, createAppointmentValidator,
  updateAppointmentValidator, rescheduleAppointmentValidator, cancelAppointmentValidator,
  appointmentQueryValidator, scheduleQueryValidator, availableSlotsQueryValidator,
  appointmentWorkspaceValidator, appointmentProcedureValidator, appointmentTagValidator,
  appointmentLabOrderValidator, appointmentCommunicationValidator,
} from '../validators/appointment.validator';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: Get all appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *       - in: query
 *         name: providerId
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of appointments }
 *       401: { description: Unauthorized }
 */
router.get('/', validate(appointmentQueryValidator), appointmentController.getAllAppointments.bind(appointmentController));

/**
 * @swagger
 * /appointments/calendar:
 *   get:
 *     summary: Get calendar schedule for multiple providers
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Calendar schedule }
 *       403: { description: Forbidden }
 */
router.get('/calendar', requireRoles('Front Desk', 'Admin', 'Doctor'), appointmentController.getCalendarSchedule.bind(appointmentController));

/**
 * @swagger
 * /appointments/providers/{providerId}/schedule:
 *   get:
 *     summary: Get provider schedule (day/week/month)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: view
 *         schema: { type: string, enum: [day, week, month] }
 *     responses:
 *       200: { description: Provider schedule }
 *       403: { description: Forbidden }
 */
router.get('/providers/:providerId/schedule', requireRoles('Front Desk', 'Admin', 'Doctor'), validate([...providerIdValidator, ...scheduleQueryValidator]), appointmentController.getProviderSchedule.bind(appointmentController));

/**
 * @swagger
 * /appointments/providers/{providerId}/available-slots:
 *   get:
 *     summary: Get available time slots for a provider
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Available slots }
 *       403: { description: Forbidden }
 */
router.get('/providers/:providerId/available-slots', requireRoles('Front Desk', 'Admin'), validate([...providerIdValidator, ...availableSlotsQueryValidator]), appointmentController.getAvailableSlots.bind(appointmentController));

/**
 * @swagger
 * /appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAppointmentRequest'
 *     responses:
 *       201: { description: Appointment created }
 *       403: { description: Forbidden }
 */
router.post('/', requireRoles('Front Desk', 'Admin'), validate(createAppointmentValidator), appointmentController.createAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}:
 *   get:
 *     summary: Get appointment by ID
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Appointment details }
 *       404: { description: Not found }
 */
router.get('/:appointmentId', validate(appointmentIdValidator), appointmentController.getAppointmentById.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}:
 *   put:
 *     summary: Update an appointment
 *     tags: [Appointments]
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
 *             $ref: '#/components/schemas/Appointment'
 *     responses:
 *       200: { description: Appointment updated }
 *       403: { description: Forbidden }
 */
router.put('/:appointmentId', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...updateAppointmentValidator]), appointmentController.updateAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}:
 *   delete:
 *     summary: Delete appointment (Admin only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Appointment deleted }
 *       403: { description: Forbidden }
 */
router.delete('/:appointmentId', requireRoles('Admin'), validate(appointmentIdValidator), appointmentController.deleteAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/cancel:
 *   post:
 *     summary: Cancel an appointment
 *     tags: [Appointments]
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
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Appointment cancelled }
 *       403: { description: Forbidden }
 */
router.post('/:appointmentId/cancel', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...cancelAppointmentValidator]), appointmentController.cancelAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/reschedule:
 *   post:
 *     summary: Reschedule an appointment
 *     tags: [Appointments]
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
 *             required: [newStartTime]
 *             properties:
 *               newStartTime: { type: string, format: date-time }
 *     responses:
 *       200: { description: Appointment rescheduled }
 *       403: { description: Forbidden }
 */
router.post('/:appointmentId/reschedule', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...rescheduleAppointmentValidator]), appointmentController.rescheduleAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/check-in:
 *   post:
 *     summary: Check in a patient
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Patient checked in }
 *       403: { description: Forbidden }
 */
router.post('/:appointmentId/check-in', requireRoles('Front Desk', 'Admin', 'Nursing'), validate(appointmentIdValidator), appointmentController.checkInAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/check-out:
 *   post:
 *     summary: Check out a patient
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Patient checked out }
 *       403: { description: Forbidden }
 */
router.post('/:appointmentId/check-out', requireRoles('Front Desk', 'Admin', 'Nursing'), validate(appointmentIdValidator), appointmentController.checkOutAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/workspace:
 *   get:
 *     summary: Get appointment workspace
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Appointment workspace }
 *   patch:
 *     summary: Update appointment workspace
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Workspace updated }
 *       403: { description: Forbidden }
 */
router.get('/:appointmentId/workspace', validate(appointmentIdValidator), appointmentController.getAppointmentWorkspace.bind(appointmentController));
router.patch('/:appointmentId/workspace', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...appointmentWorkspaceValidator]), appointmentController.updateAppointmentWorkspace.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/procedures:
 *   get:
 *     summary: Get appointment procedures
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: 
 *         description: List of procedures
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401: { description: Unauthorized }
 *       404: { description: Appointment not found }
 * 
 *   post:
 *     summary: Add procedure to appointment
 *     description: Add a dental procedure to an existing appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: The ID of the appointment
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - code
 *               - fee
 *               - status
 *             properties:
 *               description:
 *                 type: string
 *                 description: Procedure description
 *                 example: "Full Mouth X-Ray"
 *                 minLength: 1
 *                 maxLength: 255
 *               code:
 *                 type: string
 *                 description: Dental procedure code (CDT code)
 *                 example: "D0210"
 *                 pattern: '^D[0-9]{4}$'
 *               fee:
 *                 type: number
 *                 format: float
 *                 description: Procedure fee/charge
 *                 example: 250.00
 *                 minimum: 0
 *               quantity:
 *                 type: integer
 *                 description: Number of units
 *                 example: 1
 *                 default: 1
 *                 minimum: 1
 *               status:
 *                 type: string
 *                 description: Procedure status (1=Planned, 2=Completed, 3=Cancelled)
 *                 enum: ["1", "2", "3"]
 *                 example: "2"
 *           example:
 *             description: "Full Mouth X-Ray"
 *             code: "D0210"
 *             fee: 250.00
 *             quantity: 1
 *             status: "2"
 *     responses:
 *       201:
 *         description: Procedure added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Procedure added successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     appointmentId:
 *                       type: integer
 *                     description:
 *                       type: string
 *                     code:
 *                       type: string
 *                     fee:
 *                       type: number
 *                     quantity:
 *                       type: integer
 *                     status:
 *                       type: string
 *       400:
 *         description: Bad request - missing required fields or invalid data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Description is required"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Appointment not found
 *       500:
 *         description: Internal server error
 */
router.get('/:appointmentId/procedures', validate(appointmentIdValidator), appointmentController.getAppointmentProcedures.bind(appointmentController));
router.post('/:appointmentId/procedures', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...appointmentProcedureValidator]), appointmentController.addAppointmentProcedure.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/tags:
 *   get:
 *     summary: Get appointment tags
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of tags }
 *   post:
 *     summary: Add tag to appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201: { description: Tag added }
 *       403: { description: Forbidden }
 */
router.get('/:appointmentId/tags', validate(appointmentIdValidator), appointmentController.getAppointmentTags.bind(appointmentController));
router.post('/:appointmentId/tags', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...appointmentTagValidator]), appointmentController.addAppointmentTag.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/lab-orders:
 *   post:
 *     summary: Add lab order to appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201: { description: Lab order added }
 *       403: { description: Forbidden }
 */
router.post('/:appointmentId/lab-orders', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...appointmentLabOrderValidator]), appointmentController.addAppointmentLabOrder.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/communications/send:
 *   post:
 *     summary: Send communication for appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Communication sent }
 *       403: { description: Forbidden }
 */
router.post('/:appointmentId/communications/send', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...appointmentCommunicationValidator]), appointmentController.createAppointmentCommunication.bind(appointmentController));

export default router;