import { Router } from 'express';
import { body } from 'express-validator';
import { recurringAppointmentController } from '../controllers/recurring-appointment.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  recurringAppointmentIdValidator,
  createRecurringAppointmentValidator,
  updateRecurringAppointmentValidator,
  generateAppointmentsValidator,
  recurringAppointmentQueryValidator,
} from '../validators/recurring-appointment.validator';

const router = Router();

// All recurring appointment routes require authentication
router.use(authenticate);
router.use(resolveBranchAccess);
router.use(enterTenantContext);

/**
 * @swagger
 * /recurring-appointments:
 *   get:
 *     summary: Get all recurring appointments
 *     tags: [Recurring Appointments]
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
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of recurring appointments
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  validate(recurringAppointmentQueryValidator),
  recurringAppointmentController.getAllRecurringAppointments.bind(recurringAppointmentController)
);

/**
 * @swagger
 * /recurring-appointments/{recurringAppointmentId}:
 *   get:
 *     summary: Get recurring appointment by ID
 *     tags: [Recurring Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recurringAppointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Recurring appointment details
 *       404:
 *         description: Recurring appointment not found
 */
router.get(
  '/:recurringAppointmentId',
  validate(recurringAppointmentIdValidator),
  recurringAppointmentController.getRecurringAppointmentById.bind(recurringAppointmentController)
);

/**
 * @swagger
 * /recurring-appointments/preview:
 *   post:
 *     summary: Preview recurring appointment series (before creating)
 *     tags: [Recurring Appointments]
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
 *               - appointmentTypeId
 *               - frequency
 *               - frequencyValue
 *               - startDate
 *               - preferredTime
 *             properties:
 *               providerId:
 *                 type: integer
 *               appointmentTypeId:
 *                 type: integer
 *               frequency:
 *                 type: string
 *                 enum: [weekly, monthly, quarterly]
 *               frequencyValue:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 52
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               preferredTime:
 *                 type: string
 *                 pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'
 *               preferredDayOfWeek:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *               totalAppointments:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Preview of recurring appointments
 */
router.post(
  '/preview',
  requireRoles('Receptionist', 'Admin'),
  validate([
    body('providerId')
      .notEmpty()
      .withMessage('Provider ID is required')
      .isInt({ min: 1 })
      .withMessage('Invalid provider ID format'),
    body('appointmentTypeId')
      .notEmpty()
      .withMessage('Appointment type ID is required')
      .isInt({ min: 1 })
      .withMessage('Invalid appointment type ID format'),
    body('frequency')
      .notEmpty()
      .withMessage('Frequency is required')
      .isIn(['weekly', 'monthly', 'quarterly'])
      .withMessage('Frequency must be one of: weekly, monthly, quarterly'),
    body('frequencyValue')
      .notEmpty()
      .withMessage('Frequency value is required')
      .isInt({ min: 1, max: 52 })
      .withMessage('Frequency value must be between 1 and 52'),
    body('startDate')
      .notEmpty()
      .withMessage('Start date is required')
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    body('preferredTime')
      .notEmpty()
      .withMessage('Preferred time is required')
      .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Preferred time must be in HH:MM format (24-hour)'),
    body('preferredDayOfWeek')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage('Preferred day of week must be between 0 (Sunday) and 6 (Saturday)'),
    body('totalAppointments')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Total appointments must be between 1 and 100'),
  ]),
  recurringAppointmentController.previewRecurringAppointments.bind(recurringAppointmentController)
);

/**
 * @swagger
 * /recurring-appointments:
 *   post:
 *     summary: Create recurring appointment series
 *     tags: [Recurring Appointments]
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
 *               - frequency
 *               - frequencyValue
 *               - startDate
 *               - preferredTime
 *             properties:
 *               patientId:
 *                 type: integer
 *               providerId:
 *                 type: integer
 *               appointmentTypeId:
 *                 type: integer
 *               frequency:
 *                 type: string
 *                 enum: [weekly, monthly, quarterly]
 *               frequencyValue:
 *                 type: integer
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               preferredTime:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Recurring appointment series created
 */
router.post(
  '/',
  requireRoles('Receptionist', 'Admin'),
  validate(createRecurringAppointmentValidator),
  recurringAppointmentController.createRecurringAppointment.bind(recurringAppointmentController)
);

/**
 * @swagger
 * /recurring-appointments/with-resolution:
 *   post:
 *     summary: Create recurring appointment with conflict resolution
 *     tags: [Recurring Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             allOf:
 *               - $ref: '#/components/schemas/CreateRecurringAppointmentRequest'
 *               - type: object
 *                 properties:
 *                   appointmentOverrides:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         appointmentNumber:
 *                           type: integer
 *                         skip:
 *                           type: boolean
 *                         customDate:
 *                           type: string
 *                           format: date
 *                         customStartTime:
 *                           type: string
 *                         customEndTime:
 *                           type: string
 *     responses:
 *       201:
 *         description: Recurring appointment series created with overrides
 */
router.post(
  '/with-resolution',
  requireRoles('Receptionist', 'Admin'),
  validate([
    ...createRecurringAppointmentValidator,
    body('appointmentOverrides')
      .optional()
      .isArray()
      .withMessage('appointmentOverrides must be an array'),
    body('appointmentOverrides.*.appointmentNumber')
      .optional()
      .isInt({ min: 1 })
      .withMessage('appointmentNumber must be a positive integer'),
    body('appointmentOverrides.*.skip')
      .optional()
      .isBoolean()
      .withMessage('skip must be a boolean'),
    body('appointmentOverrides.*.customDate')
      .optional()
      .isISO8601()
      .withMessage('customDate must be a valid ISO 8601 date'),
    body('appointmentOverrides.*.customStartTime')
      .optional()
      .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('customStartTime must be in HH:MM format'),
    body('appointmentOverrides.*.customEndTime')
      .optional()
      .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('customEndTime must be in HH:MM format'),
  ]),
  recurringAppointmentController.createRecurringAppointmentWithResolution.bind(recurringAppointmentController)
);

/**
 * @swagger
 * /recurring-appointments/{recurringAppointmentId}/generate:
 *   post:
 *     summary: Generate appointments from recurring series
 *     tags: [Recurring Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recurringAppointmentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endDate:
 *                 type: string
 *                 format: date
 *               totalAppointments:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Appointments generated
 */
router.post(
  '/:recurringAppointmentId/generate',
  requireRoles('Receptionist', 'Admin'),
  validate([...recurringAppointmentIdValidator, ...generateAppointmentsValidator]),
  recurringAppointmentController.generateAppointments.bind(recurringAppointmentController)
);

/**
 * @swagger
 * /recurring-appointments/{recurringAppointmentId}:
 *   put:
 *     summary: Update recurring appointment series
 *     tags: [Recurring Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recurringAppointmentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency:
 *                 type: string
 *                 enum: [weekly, monthly, quarterly]
 *               frequencyValue:
 *                 type: integer
 *               preferredTime:
 *                 type: string
 *               notes:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Recurring appointment updated
 */
router.put(
  '/:recurringAppointmentId',
  requireRoles('Receptionist', 'Admin'),
  validate([...recurringAppointmentIdValidator, ...updateRecurringAppointmentValidator]),
  recurringAppointmentController.updateRecurringAppointment.bind(recurringAppointmentController)
);

/**
 * @swagger
 * /recurring-appointments/{recurringAppointmentId}/appointments:
 *   get:
 *     summary: Get linked appointments for a recurring appointment
 *     tags: [Recurring Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recurringAppointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of linked appointments
 */
router.get(
  '/:recurringAppointmentId/appointments',
  validate(recurringAppointmentIdValidator),
  recurringAppointmentController.getLinkedAppointments.bind(recurringAppointmentController)
);

/**
 * @swagger
 * /recurring-appointments/{recurringAppointmentId}:
 *   delete:
 *     summary: Delete recurring appointment series (Admin only)
 *     tags: [Recurring Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recurringAppointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Recurring appointment deleted
 *       403:
 *         description: Admin only
 *       404:
 *         description: Recurring appointment not found
 */
router.delete(
  '/:recurringAppointmentId',
  requireRoles('Admin'),
  validate(recurringAppointmentIdValidator),
  recurringAppointmentController.deleteRecurringAppointment.bind(recurringAppointmentController)
);

export default router;