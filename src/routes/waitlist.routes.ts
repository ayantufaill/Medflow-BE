import { Router } from 'express';
import { waitlistController } from '../controllers/waitlist.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  waitlistEntryIdValidator,
  createWaitlistEntryValidator,
  updateWaitlistEntryValidator,
  waitlistQueryValidator,
  convertWaitlistToAppointmentValidator,
} from '../validators/waitlist.validator';

const router = Router();

// All waitlist routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /waitlist:
 *   get:
 *     summary: Get all waitlist entries
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *         description: Items per page (max 100)
 *         example: 10
 *       - in: query
 *         name: patientId
 *         schema: { type: integer, minimum: 1 }
 *         description: Filter by patient ID
 *         example: 1
 *       - in: query
 *         name: providerId
 *         schema: { type: integer, minimum: 1 }
 *         description: Filter by provider ID
 *         example: 1
 *       - in: query
 *         name: status
 *         schema: 
 *           type: string
 *           enum: [active, called, scheduled, expired]
 *         description: Filter by status
 *         example: active
 *       - in: query
 *         name: priority
 *         schema: 
 *           type: string
 *           enum: [urgent, normal, flexible]
 *         description: Filter by priority
 *         example: normal
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 100 }
 *         description: Search term for patient name or notes
 *         example: John
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: Filter entries from this date (ISO 8601)
 *         example: 2026-04-01
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *         description: Filter entries up to this date (ISO 8601)
 *         example: 2026-04-30
 *     responses:
 *       200:
 *         description: List of waitlist entries
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
router.get(
  '/',
  validate(waitlistQueryValidator),
  waitlistController.getAllWaitlistEntries.bind(waitlistController)
);

/**
 * @swagger
 * /waitlist/{waitlistEntryId}:
 *   get:
 *     summary: Get waitlist entry by ID
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: Waitlist entry ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Waitlist entry details
 *       404:
 *         description: Entry not found
 */
router.get(
  '/:waitlistEntryId',
  validate(waitlistEntryIdValidator),
  waitlistController.getWaitlistEntryById.bind(waitlistController)
);

/**
 * @swagger
 * /waitlist:
 *   post:
 *     summary: Create waitlist entry (Front Desk/Admin only)
 *     tags: [Waitlist]
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
 *               appointmentTypeId:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *                 description: Appointment type ID (required)
 *               preferredDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-25
 *                 description: Preferred appointment date (ISO 8601 format)
 *               preferredTimeStart:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 09:00
 *                 description: Preferred start time in HH:MM format (24-hour)
 *               preferredTimeEnd:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 17:00
 *                 description: Preferred end time in HH:MM format (24-hour)
 *               priority:
 *                 type: string
 *                 enum: [urgent, normal, flexible]
 *                 example: normal
 *                 description: Priority level
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 example: Patient prefers morning appointments
 *                 description: Additional notes
 *           example:
 *             patientId: 1
 *             providerId: 1
 *             appointmentTypeId: 1
 *             preferredDate: 2026-04-25
 *             preferredTimeStart: 09:00
 *             preferredTimeEnd: 17:00
 *             priority: normal
 *             notes: Patient prefers morning appointments
 *     responses:
 *       201:
 *         description: Waitlist entry created
 *       400:
 *         description: Invalid input - Missing required fields (patientId, providerId, appointmentTypeId)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires Front Desk or Admin role
 */
router.post(
  '/',
  requireRoles('Front Desk', 'Admin'),
  validate(createWaitlistEntryValidator),
  waitlistController.createWaitlistEntry.bind(waitlistController)
);

/**
 * @swagger
 * /waitlist/{waitlistEntryId}:
 *   put:
 *     summary: Update waitlist entry (Front Desk/Admin only)
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: Waitlist entry ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appointmentTypeId:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *                 description: Updated appointment type ID
 *               preferredDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-26
 *                 description: Updated preferred date (ISO 8601)
 *               preferredTimeStart:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 10:30
 *                 description: Updated start time (HH:MM format)
 *               preferredTimeEnd:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *                 example: 18:00
 *                 description: Updated end time (HH:MM format)
 *               priority:
 *                 type: string
 *                 enum: [urgent, normal, flexible]
 *                 example: urgent
 *                 description: Updated priority
 *               status:
 *                 type: string
 *                 enum: [active, called, scheduled, expired]
 *                 example: called
 *                 description: Updated status
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 example: Patient requested urgent appointment
 *                 description: Updated notes
 *           example:
 *             appointmentTypeId: 2
 *             preferredDate: 2026-04-26
 *             preferredTimeStart: 10:30
 *             preferredTimeEnd: 18:00
 *             priority: urgent
 *             status: called
 *             notes: Patient requested urgent appointment
 *     responses:
 *       200:
 *         description: Waitlist entry updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Entry not found
 */
router.put(
  '/:waitlistEntryId',
  requireRoles('Front Desk', 'Admin'),
  validate([...waitlistEntryIdValidator, ...updateWaitlistEntryValidator]),
  waitlistController.updateWaitlistEntry.bind(waitlistController)
);

/**
 * @swagger
 * /waitlist/{waitlistEntryId}/called:
 *   post:
 *     summary: Mark waitlist entry as called (Front Desk/Admin only)
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: Waitlist entry ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Entry marked as called
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
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Entry not found
 */
router.post(
  '/:waitlistEntryId/called',
  requireRoles('Front Desk', 'Admin'),
  validate(waitlistEntryIdValidator),
  waitlistController.markAsCalled.bind(waitlistController)
);

/**
 * @swagger
 * /waitlist/{waitlistEntryId}/scheduled:
 *   post:
 *     summary: Mark waitlist entry as scheduled (Front Desk/Admin only)
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: Waitlist entry ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Entry marked as scheduled
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
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Entry not found
 */
router.post(
  '/:waitlistEntryId/scheduled',
  requireRoles('Front Desk', 'Admin'),
  validate(waitlistEntryIdValidator),
  waitlistController.markAsScheduled.bind(waitlistController)
);

/**
 * @swagger
 * /waitlist/{waitlistEntryId}/convert-to-appointment:
 *   post:
 *     summary: Convert waitlist entry to appointment (Front Desk/Admin only)
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: Waitlist entry ID to convert (must be in 'active' status)
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
 *                 example: 2026-04-26
 *                 description: Date of the appointment (ISO 8601, required)
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
 *               durationMinutes:
 *                 type: integer
 *                 minimum: 5
 *                 example: 30
 *                 description: Duration in minutes (optional, min 5)
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 example: Converted from waitlist
 *                 description: Additional notes
 *               roomId:
 *                 type: string
 *                 maxLength: 100
 *                 example: Room 101
 *                 description: Room assignment
 *               chiefComplaint:
 *                 type: string
 *                 maxLength: 500
 *                 example: Persistent cough and fever
 *                 description: Patient's chief complaint
 *           example:
 *             appointmentDate: 2026-04-26
 *             startTime: 09:00
 *             endTime: 09:30
 *             durationMinutes: 30
 *             notes: Converted from waitlist
 *             roomId: Room 101
 *             chiefComplaint: Persistent cough and fever
 *     responses:
 *       201:
 *         description: Appointment created from waitlist
 *       400:
 *         description: Invalid input - Missing required fields or waitlist entry already scheduled
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Waitlist entry not found
 */
router.post(
  '/:waitlistEntryId/convert-to-appointment',
  requireRoles('Front Desk', 'Admin'),
  validate([...waitlistEntryIdValidator, ...convertWaitlistToAppointmentValidator]),
  waitlistController.convertToAppointment.bind(waitlistController)
);

/**
 * @swagger
 * /waitlist/{waitlistEntryId}:
 *   delete:
 *     summary: Delete waitlist entry (Front Desk/Admin only)
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: Waitlist entry ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Waitlist entry deleted
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
 *         description: Forbidden - Requires Front Desk or Admin role
 *       404:
 *         description: Entry not found
 */
router.delete(
  '/:waitlistEntryId',
  requireRoles('Front Desk', 'Admin'),
  validate(waitlistEntryIdValidator),
  waitlistController.deleteWaitlistEntry.bind(waitlistController)
);

export default router;