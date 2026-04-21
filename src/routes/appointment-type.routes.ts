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
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         description: Items per page
 *       - in: query
 *         name: isHidden
 *         schema: { type: boolean }
 *         description: Include hidden types
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
 *               - duration
 *             properties:
 *               name:
 *                 type: string
 *                 example: Checkup
 *               duration:
 *                 type: integer
 *                 example: 30
 *               color:
 *                 type: string
 *                 example: "#FF0000"
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment type created
 *       403:
 *         description: Admin only
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               duration:
 *                 type: integer
 *               color:
 *                 type: string
 *               isHidden:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Appointment type updated
 *       403:
 *         description: Admin only
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
 *     responses:
 *       200:
 *         description: Appointment type deleted
 *       403:
 *         description: Admin only
 *       404:
 *         description: Appointment type not found
 */
router.delete(
  '/:appointmentTypeId',
  requireRoles('Admin'),
  validate(appointmentTypeIdValidator),
  appointmentTypeController.deleteAppointmentType.bind(appointmentTypeController)
);

export default router;