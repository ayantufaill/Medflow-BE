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
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Filter by end date
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *         description: Filter by patient ID
 *       - in: query
 *         name: providerId
 *         schema: { type: integer }
 *         description: Filter by provider ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of appointments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointments:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - insufficient permissions
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
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Start date for calendar view
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: End date for calendar view
 *       - in: query
 *         name: providerIds
 *         schema: { type: array, items: { type: integer } }
 *         description: Comma-separated list of provider IDs
 *     responses:
 *       200:
 *         description: Calendar schedule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
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
 *         description: Provider ID
 *       - in: query
 *         name: view
 *         schema: { type: string, enum: [day, week, month] }
 *         description: View type
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Reference date
 *     responses:
 *       200:
 *         description: Provider schedule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Provider not found
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
 *         description: Provider ID
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *         description: Date to check availability
 *       - in: query
 *         name: duration
 *         schema: { type: integer, default: 30 }
 *         description: Appointment duration in minutes
 *     responses:
 *       200:
 *         description: Available slots retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     slots:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Provider not found
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
 *             type: object
 *             required:
 *               - patientId
 *               - providerId
 *               - startTime
 *               - endTime
 *             properties:
 *               patientId:
 *                 type: integer
 *                 example: 1
 *                 description: Patient ID
 *               providerId:
 *                 type: integer
 *                 example: 5
 *                 description: Provider/Doctor ID
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-15T09:00:00Z"
 *                 description: Appointment start time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-15T09:30:00Z"
 *                 description: Appointment end time
 *               appointmentTypeId:
 *                 type: integer
 *                 example: 1
 *                 description: Type of appointment
 *               notes:
 *                 type: string
 *                 example: "Patient requested morning appointment"
 *               status:
 *                 type: string
 *                 enum: [scheduled, confirmed, completed, cancelled, no-show]
 *                 default: scheduled
 *     responses:
 *       201:
 *         description: Appointment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request - missing required fields or invalid data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       409:
 *         description: Conflict - time slot already booked
 *       422:
 *         description: Validation failed
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
 *         description: Appointment ID
 *     responses:
 *       200:
 *         description: Appointment details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Appointment not found
 */
router.get('/:appointmentId', requireRoles('Admin'), validate(appointmentIdValidator), appointmentController.getAppointmentById.bind(appointmentController));

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
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               providerId:
 *                 type: integer
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [scheduled, confirmed, completed, cancelled, no-show]
 *     responses:
 *       200:
 *         description: Appointment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request - invalid data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
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
 *         description: Appointment ID
 *     responses:
 *       200:
 *         description: Appointment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Appointment not found
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
 *         description: Appointment ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Patient requested cancellation"
 *               cancelledBy:
 *                 type: string
 *                 example: "Front Desk"
 *     responses:
 *       200:
 *         description: Appointment cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     cancelledAt:
 *                       type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       422:
 *         description: Validation failed - appointment already cancelled or completed
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
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newStartTime
 *               - newEndTime
 *             properties:
 *               newStartTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-20T10:00:00Z"
 *               newEndTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-20T10:30:00Z"
 *               reason:
 *                 type: string
 *                 example: "Provider schedule conflict"
 *     responses:
 *       200:
 *         description: Appointment rescheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     oldStartTime:
 *                       type: string
 *                     newStartTime:
 *                       type: string
 *       400:
 *         description: Bad request - invalid time slot
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Conflict - time slot already booked
 *       422:
 *         description: Validation failed
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
 *         description: Appointment ID
 *     responses:
 *       200:
 *         description: Patient checked in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     checkedInAt:
 *                       type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       422:
 *         description: Validation failed - appointment already checked in
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
 *         description: Appointment ID
 *     responses:
 *       200:
 *         description: Patient checked out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     checkedOutAt:
 *                       type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       422:
 *         description: Validation failed - appointment not checked in
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
 *         description: Appointment ID
 *     responses:
 *       200:
 *         description: Appointment workspace retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Appointment not found
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
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               clinicalNotes:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Workspace updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 */
router.get('/:appointmentId/workspace', requireRoles('Admin'), appointmentController.getAppointmentWorkspace.bind(appointmentController));
/**
 * @swagger
 * /appointments/{appointmentId}/workspace:
 *   patch:
 *     summary: Patch :appointmentId workspace
 *     tags: [Appointment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

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
 *         description: Appointment ID
 *     responses:
 *       200:
 *         description: List of procedures retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       procedureCode:
 *                         type: string
 *                       description:
 *                         type: string
 *                       fee:
 *                         type: number
 *                       status:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Appointment not found
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
 *               toothNumber:
 *                 type: string
 *                 description: Tooth number (1-32)
 *                 example: "19"
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *               status:
 *                 type: string
 *                 description: Procedure status
 *                 enum: ["planned", "completed", "cancelled"]
 *                 default: "planned"
 *                 example: "planned"
 *           example:
 *             description: "Full Mouth X-Ray"
 *             code: "D0210"
 *             fee: 250.00
 *             quantity: 1
 *             status: "planned"
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Appointment not found
 *       422:
 *         description: Validation failed - invalid procedure code
 *       500:
 *         description: Internal server error
 */
router.get('/:appointmentId/procedures', requireRoles('Admin'), appointmentController.getAppointmentProcedures.bind(appointmentController));
/**
 * @swagger
 * /appointments/{appointmentId}/procedures:
 *   post:
 *     summary: Post :appointmentId procedures
 *     tags: [Appointment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

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
 *         description: Appointment ID
 *     responses:
 *       200:
 *         description: List of tags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       color:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Appointment not found
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
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "urgent"
 *                 description: Tag name
 *               color:
 *                 type: string
 *                 example: "#FF0000"
 *                 description: Tag color in hex format
 *     responses:
 *       201:
 *         description: Tag added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Conflict - tag already exists
 */
router.get('/:appointmentId/tags', requireRoles('Admin'), appointmentController.getAppointmentTags.bind(appointmentController));
/**
 * @swagger
 * /appointments/{appointmentId}/tags:
 *   post:
 *     summary: Post :appointmentId tags
 *     tags: [Appointment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

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
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - testName
 *             properties:
 *               testName:
 *                 type: string
 *                 example: "Complete Blood Count"
 *                 description: Name of the lab test
 *               instructions:
 *                 type: string
 *                 example: "Patient should fast for 8 hours"
 *                 description: Instructions for the patient
 *               priority:
 *                 type: string
 *                 enum: [routine, urgent, stat]
 *                 default: routine
 *                 description: Priority of the lab order
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Lab order added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       422:
 *         description: Validation failed - invalid test name
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
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - message
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, sms, push, in_app]
 *                 description: Communication type
 *               message:
 *                 type: string
 *                 maxLength: 500
 *                 description: Message content
 *               recipient:
 *                 type: string
 *                 description: Email address or phone number
 *               subject:
 *                 type: string
 *                 description: Subject line (for email)
 *     responses:
 *       200:
 *         description: Communication sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     type:
 *                       type: string
 *                     status:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       422:
 *         description: Validation failed - invalid message content
 */
router.post('/:appointmentId/communications/send', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...appointmentCommunicationValidator]), appointmentController.createAppointmentCommunication.bind(appointmentController));

export default router;