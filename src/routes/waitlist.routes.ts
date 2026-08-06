import { Router } from 'express';
import { waitlistController } from '../controllers/waitlist.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
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
router.use(resolveBranchAccess);
router.use(enterTenantContext);

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
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *       - in: query
 *         name: providerId
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [waiting, called, scheduled, cancelled] }
 *     responses:
 *       200:
 *         description: List of waitlist entries
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
 *         schema: { type: integer }
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
 *     summary: Create waitlist entry
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
 *             properties:
 *               patientId:
 *                 type: integer
 *               providerId:
 *                 type: integer
 *               preferredDate:
 *                 type: string
 *                 format: date
 *               preferredTime:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Waitlist entry created
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
 *     summary: Update waitlist entry
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferredDate:
 *                 type: string
 *                 format: date
 *               preferredTime:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Waitlist entry updated
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
 *     summary: Mark waitlist entry as called
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Entry marked as called
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
 *     summary: Mark waitlist entry as scheduled
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Entry marked as scheduled
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
 *     summary: Convert waitlist entry to appointment
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startTime
 *             properties:
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               appointmentTypeId:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment created from waitlist
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
 *     summary: Delete waitlist entry
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: waitlistEntryId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Waitlist entry deleted
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