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

/**
 * @swagger
 * /appointment-types:
 *   get:
 *     summary: Get all appointment types
 *     tags: [Appointment Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         description: Items per page
 *         example: 10
 *       - in: query
 *         name: isHidden
 *         schema: { type: boolean }
 *         description: Include hidden types
 *         example: false
 *     responses:
 *       200:
 *         description: List of appointment types
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  validate(appointmentTypeQueryValidator),
  appointmentTypeController.getAllAppointmentTypes.bind(appointmentTypeController)
);

/**
 * @swagger
 * /appointment-types/{appointmentTypeId}:
 *   get:
 *     summary: Get appointment type by ID
 *     tags: [Appointment Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentTypeId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment type ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Appointment type details
 *       404:
 *         description: Appointment type not found
 */
router.get(
  '/:appointmentTypeId',
  validate(appointmentTypeIdValidator),
  appointmentTypeController.getAppointmentTypeById.bind(appointmentTypeController)
);

/**
 * @swagger
 * /appointment-types:
 *   post:
 *     summary: Create new appointment type (Admin only)
 *     tags: [Appointment Types]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - defaultDuration
 *               - isActive
 *             properties:
 *               name:
 *                 type: string
 *                 example: Checkup
 *                 description: Name of the appointment type (required)
 *               defaultDuration:
 *                 type: integer
 *                 example: 30
 *                 description: Duration in minutes (required)
 *               isActive:
 *                 type: boolean
 *                 example: true
 *                 description: Whether this appointment type is active (required)
 *               color:
 *                 type: string
 *                 example: "#FF0000"
 *                 description: Hex color code for UI display (optional)
 *               description:
 *                 type: string
 *                 example: Regular checkup appointment
 *                 description: Description of the appointment type (optional)
 *           example:
 *             name: Checkup
 *             defaultDuration: 30
 *             isActive: true
 *             color: "#FF0000"
 *             description: Regular checkup appointment
 *     responses:
 *       201:
 *         description: Appointment type created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input - Missing required fields (name, defaultDuration, isActive)
 *       403:
 *         description: Admin only - Requires Admin role
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.post(
  '/',
  requireRoles('Admin'),
  validate(createAppointmentTypeValidator),
  appointmentTypeController.createAppointmentType.bind(appointmentTypeController)
);

/**
 * @swagger
 * /appointment-types/{appointmentTypeId}:
 *   put:
 *     summary: Update appointment type (Admin only)
 *     tags: [Appointment Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentTypeId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment type ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Follow-up
 *                 description: Updated name
 *               defaultDuration:
 *                 type: integer
 *                 example: 45
 *                 description: Updated duration in minutes
 *               isActive:
 *                 type: boolean
 *                 example: true
 *                 description: Whether this appointment type is active
 *               color:
 *                 type: string
 *                 example: "#00FF00"
 *                 description: Updated hex color code
 *               description:
 *                 type: string
 *                 example: Follow-up appointment after initial visit
 *                 description: Updated description
 *           example:
 *             name: Follow-up
 *             defaultDuration: 45
 *             isActive: true
 *             color: "#00FF00"
 *             description: Follow-up appointment after initial visit
 *     responses:
 *       200:
 *         description: Appointment type updated
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
 *         description: Admin only - Requires Admin role
 *       404:
 *         description: Appointment type not found
 */
router.put(
  '/:appointmentTypeId',
  requireRoles('Admin'),
  validate([...appointmentTypeIdValidator, ...updateAppointmentTypeValidator]),
  appointmentTypeController.updateAppointmentType.bind(appointmentTypeController)
);

/**
 * @swagger
 * /appointment-types/{appointmentTypeId}:
 *   delete:
 *     summary: Delete appointment type (Admin only)
 *     tags: [Appointment Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentTypeId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment type ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Appointment type deleted
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
 *         description: Admin only - Requires Admin role
 *       404:
 *         description: Appointment type not found
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.delete(
  '/:appointmentTypeId',
  requireRoles('Admin'),
  validate(appointmentTypeIdValidator),
  appointmentTypeController.deleteAppointmentType.bind(appointmentTypeController)
);

export default router;