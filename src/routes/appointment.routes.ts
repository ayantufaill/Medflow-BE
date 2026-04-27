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
 *         description: Filter appointments from this date
 *         example: 2026-04-01
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Filter appointments up to this date
 *         example: 2026-04-30
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *         description: Filter by patient ID
 *         example: 1
 *       - in: query
 *         name: providerId
 *         schema: { type: integer }
 *         description: Filter by provider ID
 *         example: 1
 *       - in: query
 *         name: status
 *         schema: 
 *           type: string
 *           enum: [scheduled, completed, cancelled, no-show]
 *         description: Filter by appointment status
 *         example: scheduled
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *         description: Items per page
 *         example: 10
 *     responses:
 *       200: 
 *         description: List of appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                 pagination:
 *                   type: object
 *       400:
 *         description: Invalid query parameters
 *       401: 
 *         description: Unauthorized
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
 *         required: true
 *         schema: { type: string, format: date }
 *         description: Start date for calendar range (required)
 *         example: 2026-04-01
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, format: date }
 *         description: End date for calendar range (required)
 *         example: 2026-04-30
 *       - in: query
 *         name: view
 *         schema: 
 *           type: string
 *           enum: [day, week, month]
 *         description: Calendar view type (optional)
 *         example: week
 *       - in: query
 *         name: providerIds
 *         schema: 
 *           type: string
 *         description: Comma-separated list of provider IDs to include (optional)
 *         example: "1,2,3"
 *     responses:
 *       200: 
 *         description: Calendar schedule
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
 *                     availableSlots:
 *                       type: object
 *       400:
 *         description: Missing required parameters (startDate and endDate)
 *       401:
 *         description: Unauthorized
 *       403: 
 *         description: Forbidden - Requires Front Desk, Admin, or Doctor role
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
 *         example: 1
 *       - in: query
 *         name: view
 *         required: true
 *         schema: 
 *           type: string
 *           enum: [day, week, month]
 *         description: Schedule view type (required)
 *         example: day
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Date for day view (required when view=day)
 *         example: 2026-04-25
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Start date for week/month view (required when view=week or view=month)
 *         example: 2026-04-20
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: End date for week/month view (required when view=week or view=month)
 *         example: 2026-04-26
 *     responses:
 *       200: 
 *         description: Provider schedule
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
 *                     providerId:
 *                       type: integer
 *                     providerName:
 *                       type: string
 *                     schedule:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Invalid parameters - Provide either date or both startDate and endDate
 *       403: 
 *         description: Forbidden - Requires Front Desk, Admin, or Doctor role
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
 *         example: 1
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *         description: Date to check for available slots
 *         example: 2026-04-25
 *       - in: query
 *         name: durationMinutes
 *         schema: { type: integer, default: 30, minimum: 15, maximum: 120 }
 *         description: Appointment duration in minutes
 *         example: 30
 *     responses:
 *       200: 
 *         description: Available time slots
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
 *                       startTime:
 *                         type: string
 *                         example: "09:00"
 *                       endTime:
 *                         type: string
 *                         example: "09:30"
 *       400:
 *         description: Invalid date format or missing date
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Provider not found
 */
router.get('/providers/:providerId/available-slots', requireRoles('Front Desk', 'Admin'), validate([...providerIdValidator, ...availableSlotsQueryValidator]), appointmentController.getAvailableSlots.bind(appointmentController));

/**
 * @swagger
 * /appointments:
 *   post:
 *     summary: Create a new appointment (Front Desk/Admin only)
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
 *               - appointmentDate
 *               - startTime
 *               - endTime
 *               - appointmentTypeId
 *             properties:
 *               patientId:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *                 description: Patient ID (required)
 *               providerId:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *                 description: Provider ID (required)
 *               appointmentDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-25
 *                 description: Date of the appointment (required, YYYY-MM-DD)
 *               startTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 09:00
 *                 description: Start time in HH:MM format (24-hour, required)
 *               endTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 09:30
 *                 description: End time in HH:MM format (24-hour, required)
 *               appointmentTypeId:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *                 description: Appointment type ID (required)
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 example: Patient prefers morning appointments
 *                 description: Additional notes (optional)
 *               status:
 *                 type: string
 *                 enum: [scheduled, confirmed, completed, cancelled, no-show]
 *                 default: scheduled
 *                 example: scheduled
 *                 description: Appointment status (optional, defaults to scheduled)
 *           example:
 *             patientId: 1
 *             providerId: 1
 *             appointmentDate: 2026-04-25
 *             startTime: 09:00
 *             endTime: 09:30
 *             appointmentTypeId: 1
 *             notes: Patient prefers morning appointments
 *             status: scheduled
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
 *         description: Invalid input - Missing required fields (patientId, providerId, appointmentDate, startTime, endTime, appointmentTypeId)
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       409:
 *         description: Time slot conflict - Provider already has an appointment at this time
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
 *         example: 1
 *     responses:
 *       200: 
 *         description: Appointment details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404: 
 *         description: Appointment not found
 */
router.get('/:appointmentId', validate(appointmentIdValidator), appointmentController.getAppointmentById.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}:
 *   put:
 *     summary: Update an appointment (Front Desk/Admin only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appointmentDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-26
 *                 description: Updated appointment date
 *               startTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 10:00
 *                 description: Updated start time (HH:MM format)
 *               endTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 10:30
 *                 description: Updated end time (HH:MM format)
 *               appointmentTypeId:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *                 description: Updated appointment type ID
 *               providerId:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *                 description: Updated provider ID
 *               status:
 *                 type: string
 *                 enum: [scheduled, confirmed, completed, cancelled, no-show]
 *                 example: confirmed
 *                 description: Updated status
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 example: Patient rescheduled to later time
 *                 description: Updated notes
 *           example:
 *             appointmentDate: 2026-04-26
 *             startTime: 10:00
 *             endTime: 10:30
 *             appointmentTypeId: 2
 *             providerId: 2
 *             status: confirmed
 *             notes: Patient rescheduled to later time
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
 *         description: Invalid input
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Time slot conflict
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
 *         example: 1
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
 *       403: 
 *         description: Forbidden - Admin only
 *       404:
 *         description: Appointment not found
 */
router.delete('/:appointmentId', requireRoles('Admin'), validate(appointmentIdValidator), appointmentController.deleteAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/cancel:
 *   post:
 *     summary: Cancel an appointment (Front Desk/Admin only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: Patient requested cancellation
 *                 description: Reason for cancellation (required)
 *               cancellationType:
 *                 type: string
 *                 enum: [patient, provider, admin, no-show]
 *                 default: patient
 *                 example: patient
 *                 description: Who initiated the cancellation
 *           example:
 *             reason: Patient requested cancellation
 *             cancellationType: patient
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
 *       400:
 *         description: Cancellation reason is required
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Appointment not found
 */
router.post('/:appointmentId/cancel', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...cancelAppointmentValidator]), appointmentController.cancelAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/reschedule:
 *   post:
 *     summary: Reschedule an appointment (Front Desk/Admin only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID to reschedule
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentDate
 *               - startTime
 *               - endTime
 *             properties:
 *               appointmentDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-27
 *                 description: New appointment date (required, YYYY-MM-DD)
 *               startTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 14:00
 *                 description: New start time in HH:MM format (24-hour, required)
 *               endTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 14:30
 *                 description: New end time in HH:MM format (24-hour, required)
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: Patient requested time change
 *                 description: Reason for rescheduling (optional)
 *           example:
 *             appointmentDate: 2026-04-27
 *             startTime: 14:00
 *             endTime: 14:30
 *             reason: Patient requested time change
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
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input - Missing required fields (appointmentDate, startTime, endTime)
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Time slot conflict - New time slot is not available
 */
router.post('/:appointmentId/reschedule', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...rescheduleAppointmentValidator]), appointmentController.rescheduleAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/check-in:
 *   post:
 *     summary: Check in a patient (Front Desk/Admin/Nursing only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkInTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 08:55
 *                 description: Actual check-in time in HH:MM format (defaults to current time)
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
 *       400:
 *         description: Appointment already checked in or cannot be checked in
 *       403: 
 *         description: Forbidden - Requires Front Desk, Admin, or Nursing role
 *       404:
 *         description: Appointment not found
 */
router.post('/:appointmentId/check-in', requireRoles('Front Desk', 'Admin', 'Nursing'), validate(appointmentIdValidator), appointmentController.checkInAppointment.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/check-out:
 *   post:
 *     summary: Check out a patient (Front Desk/Admin/Nursing only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkOutTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 09:45
 *                 description: Actual check-out time in HH:MM format (defaults to current time)
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
 *       400:
 *         description: Appointment not checked in yet or cannot be checked out
 *       403: 
 *         description: Forbidden - Requires Front Desk, Admin, or Nursing role
 *       404:
 *         description: Appointment not found
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
 *         example: 1
 *     responses:
 *       200: 
 *         description: Appointment workspace data
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
 *                     workspaceData:
 *                       type: object
 *                       properties:
 *                         referralSource:
 *                           type: string
 *                         clinicalNotes:
 *                           type: string
 *                         diagnosis:
 *                           type: string
 *                         prescriptions:
 *                           type: array
 *                         vitals:
 *                           type: object
 *                     notes:
 *                       type: string
 *       404:
 *         description: Appointment not found
 *   patch:
 *     summary: Update appointment workspace (Front Desk/Admin only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workspaceData:
 *                 type: object
 *                 description: Workspace data to update
 *                 properties:
 *                   referralSource:
 *                     type: string
 *                     example: "Primary Care Physician"
 *                     description: Source of patient referral
 *                   clinicalNotes:
 *                     type: string
 *                     example: "Patient showed improvement"
 *                     description: Clinical observations and notes
 *                   diagnosis:
 *                     type: string
 *                     example: "Essential hypertension"
 *                     description: Patient diagnosis
 *                   prescriptions:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["Lisinopril 10mg", "Amlodipine 5mg"]
 *                     description: List of prescribed medications
 *                   vitals:
 *                     type: object
 *                     properties:
 *                       bloodPressure:
 *                         type: string
 *                         example: "120/80"
 *                       heartRate:
 *                         type: integer
 *                         example: 72
 *                       temperature:
 *                         type: number
 *                         example: 98.6
 *                       weight:
 *                         type: number
 *                         example: 70.5
 *                       height:
 *                         type: number
 *                         example: 175
 *                   procedures:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["Blood draw", "EKG"]
 *                     description: Procedures performed
 *                   labOrders:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["CBC", "Lipid panel"]
 *                     description: Lab tests ordered
 *               notes:
 *                 type: string
 *                 example: "Updated during follow-up visit"
 *                 description: Additional workspace notes
 *           example:
 *             workspaceData:
 *               referralSource: "Primary Care Physician"
 *               clinicalNotes: "Patient showed improvement in symptoms"
 *               diagnosis: "Hypertension"
 *               prescriptions: ["Lisinopril 10mg"]
 *               vitals:
 *                 bloodPressure: "120/80"
 *                 heartRate: 72
 *             notes: "Updated during follow-up visit"
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
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid workspace data
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Appointment not found
 *       500:
 *         description: Internal server error - Check request body format
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
 *         description: Appointment ID
 *         example: 1
 *     responses:
 *       200: 
 *         description: List of procedures for this appointment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                 count:
 *                   type: integer
 *   post:
 *     summary: Add procedure to appointment (Front Desk/Admin only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - procedureCode
 *               - description
 *             properties:
 *               procedureCode:
 *                 type: string
 *                 example: "99213"
 *                 description: CPT/HCPCS procedure code (required)
 *               description:
 *                 type: string
 *                 example: "Office visit - established patient"
 *                 description: Description of the procedure (required)
 *               quantity:
 *                 type: integer
 *                 default: 1
 *                 example: 1
 *                 description: Quantity of procedures performed
 *               units:
 *                 type: integer
 *                 default: 1
 *                 example: 1
 *                 description: Number of units billed
 *               modifier:
 *                 type: string
 *                 example: "25"
 *                 description: Procedure modifier (if applicable)
 *               providerId:
 *                 type: integer
 *                 example: 1
 *                 description: Specific provider who performed the procedure (optional)
 *               notes:
 *                 type: string
 *                 example: "Patient tolerated procedure well"
 *                 description: Additional notes about the procedure
 *           example:
 *             procedureCode: "99213"
 *             description: "Office visit - established patient"
 *             quantity: 1
 *             units: 1
 *             modifier: "25"
 *             notes: "Patient tolerated procedure well"
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
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input - Missing required fields (procedureCode and description are required)
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Appointment not found
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
 *         description: Appointment ID
 *         example: 1
 *     responses:
 *       200: 
 *         description: List of tags for this appointment
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
 *                     type: string
 *                     example: "urgent"
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Appointment not found
 *   post:
 *     summary: Add tag to appointment (Front Desk/Admin only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tag
 *             properties:
 *               tag:
 *                 type: string
 *                 example: "urgent"
 *                 description: Tag to add to the appointment (required)
 *           example:
 *             tag: "urgent"
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     tag:
 *                       type: string
 *                     addedAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required field (tag is required)
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Tag already exists on this appointment
 */
router.get('/:appointmentId/tags', validate(appointmentIdValidator), appointmentController.getAppointmentTags.bind(appointmentController));
router.post('/:appointmentId/tags', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...appointmentTagValidator]), appointmentController.addAppointmentTag.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/lab-orders:
 *   post:
 *     summary: Add lab order to appointment (Front Desk/Admin only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - laboratoryId
 *               - testId
 *             properties:
 *               laboratoryId:
 *                 type: integer
 *                 example: 1
 *                 description: ID of the laboratory (required)
 *               testId:
 *                 type: integer
 *                 example: 1
 *                 description: ID of the lab test to order (required)
 *               notes:
 *                 type: string
 *                 example: "CBC with differential"
 *                 description: Additional notes for the lab order
 *               priority:
 *                 type: string
 *                 enum: [routine, urgent, stat]
 *                 default: routine
 *                 example: routine
 *                 description: Priority of the lab order
 *               collectedDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-25
 *                 description: Date when sample was collected
 *           example:
 *             laboratoryId: 1
 *             testId: 1
 *             notes: "CBC with differential"
 *             priority: routine
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     labOrderId:
 *                       type: integer
 *                     status:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required fields (laboratoryId and testId are required)
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Appointment or lab test not found
 */
router.post('/:appointmentId/lab-orders', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...appointmentLabOrderValidator]), appointmentController.addAppointmentLabOrder.bind(appointmentController));

/**
 * @swagger
 * /appointments/{appointmentId}/communications/send:
 *   post:
 *     summary: Send communication for appointment (Front Desk/Admin only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *               - message
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [email, sms, push, notification]
 *                 example: email
 *                 description: Communication channel (required)
 *               message:
 *                 type: string
 *                 example: "Your appointment is confirmed for tomorrow at 9:00 AM"
 *                 description: Message content (required)
 *               recipient:
 *                 type: string
 *                 example: "patient@example.com"
 *                 description: Recipient email or phone number (required for email/sms)
 *               subject:
 *                 type: string
 *                 example: "Appointment Confirmation"
 *                 description: Subject line for email communications
 *               sendTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-04-25T10:00:00Z"
 *                 description: Scheduled time to send (defaults to now)
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["appointment_details.pdf"]
 *                 description: List of attachment URLs or IDs
 *           example:
 *             channel: "email"
 *             message: "Your appointment is confirmed for tomorrow at 9:00 AM"
 *             recipient: "patient@example.com"
 *             subject: "Appointment Confirmation"
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     communicationId:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required fields (channel and message are required)
 *       403: 
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Appointment not found
 */
router.post('/:appointmentId/communications/send', requireRoles('Front Desk', 'Admin'), validate([...appointmentIdValidator, ...appointmentCommunicationValidator]), appointmentController.createAppointmentCommunication.bind(appointmentController));

export default router;