import { Router } from 'express';
import { vitalSignController } from '../controllers/vital-sign.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  vitalSignIdValidator,
  patientIdParamValidator,
  appointmentIdParamValidator,
  createVitalSignValidator,
  updateVitalSignValidator,
  vitalSignQueryValidator,
  paginationQueryValidator,
} from '../validators/vital-sign.validator';

const router = Router();

/**
 * @swagger
 * /vital-signs:
 *   get:
 *     summary: Get all vital signs
 *     tags: [Vital Signs]
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
 *         name: fromDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: List of vital signs
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(vitalSignQueryValidator),
  vitalSignController.getAllVitalSigns
);

/**
 * @swagger
 * /vital-signs/patient/{patientId}:
 *   get:
 *     summary: Get vital signs by patient
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of patient vital signs
 */
router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('vital-signs.read'),
  validate([...patientIdParamValidator, ...paginationQueryValidator]),
  vitalSignController.getVitalSignsByPatient
);

/**
 * @swagger
 * /vital-signs/patient/{patientId}/latest:
 *   get:
 *     summary: Get latest vital signs for patient
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Latest vital signs
 */
router.get(
  '/patient/:patientId/latest',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(patientIdParamValidator),
  vitalSignController.getLatestVitalsByPatient
);

/**
 * @swagger
 * /vital-signs/patient/{patientId}/trend:
 *   get:
 *     summary: Get vital signs trend for patient
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Vital signs trend data
 */
router.get(
  '/patient/:patientId/trend',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(patientIdParamValidator),
  vitalSignController.getVitalsTrend
);

/**
 * @swagger
 * /vital-signs/appointment/{appointmentId}:
 *   get:
 *     summary: Get vital signs by appointment
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vital signs for appointment
 */
router.get(
  '/appointment/:appointmentId',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(appointmentIdParamValidator),
  vitalSignController.getVitalSignByAppointment
);

/**
 * @swagger
 * /vital-signs/{vitalSignId}:
 *   get:
 *     summary: Get vital sign by ID
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vitalSignId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vital sign details
 *       404:
 *         description: Vital sign not found
 */
router.get(
  '/:vitalSignId',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(vitalSignIdValidator),
  vitalSignController.getVitalSignById
);

/**
 * @swagger
 * /vital-signs:
 *   post:
 *     summary: Create new vital sign record
 *     tags: [Vital Signs]
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
 *               - recordedDate
 *               - recordedTime
 *             properties:
 *               patientId:
 *                 type: integer
 *                 description: Patient ID (must be a valid number)
 *                 example: 1
 *               appointmentId:
 *                 type: integer
 *                 description: Optional appointment ID
 *                 example: 1
 *               recordedDate:
 *                 type: string
 *                 format: date
 *                 description: Date when vitals were recorded (YYYY-MM-DD)
 *                 example: "2026-04-27"
 *               recordedTime:
 *                 type: string
 *                 description: Time when vitals were recorded (HH:MM format)
 *                 example: "10:30"
 *               height:
 *                 type: number
 *                 description: Height in inches (must be between 10-120 inches)
 *                 example: 68
 *               weight:
 *                 type: number
 *                 description: Weight in lbs (must be between 1-1500 lbs)
 *                 example: 160.5
 *               bloodPressureSystolic:
 *                 type: integer
 *                 description: Systolic blood pressure (mmHg) (50-300)
 *                 example: 120
 *               bloodPressureDiastolic:
 *                 type: integer
 *                 description: Diastolic blood pressure (mmHg) (30-200)
 *                 example: 80
 *               pulse:
 *                 type: integer
 *                 description: Pulse rate (beats per minute)
 *                 example: 72
 *               temperature:
 *                 type: number
 *                 description: Body temperature (Fahrenheit) (90-110)
 *                 example: 98.6
 *               respiratoryRate:
 *                 type: integer
 *                 description: Respiratory rate (breaths per minute) (5-60)
 *                 example: 16
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *                 example: "Patient felt dizzy during measurement"
 *     responses:
 *       201:
 *         description: Vital sign record created
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
 *         description: Invalid input - missing required fields or invalid patient ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  authenticate,
  requirePermission('vital-signs.create'),
  validate(createVitalSignValidator),
  vitalSignController.createVitalSign
);

/**
 * @swagger
 * /vital-signs/{vitalSignId}:
 *   put:
 *     summary: Update vital sign record
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vitalSignId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               height:
 *                 type: number
 *                 description: Height in inches (must be between 10-120 inches)
 *                 example: 68
 *               weight:
 *                 type: number
 *                 description: Weight in lbs (must be between 1-1500 lbs)
 *                 example: 160.5
 *               bloodPressureSystolic:
 *                 type: integer
 *                 description: Systolic blood pressure (mmHg) (50-300)
 *                 example: 120
 *               bloodPressureDiastolic:
 *                 type: integer
 *                 description: Diastolic blood pressure (mmHg) (30-200)
 *                 example: 80
 *               pulse:
 *                 type: integer
 *                 description: Pulse rate (beats per minute)
 *                 example: 72
 *               temperature:
 *                 type: number
 *                 description: Body temperature (Fahrenheit) (90-110)
 *                 example: 98.6
 *               respiratoryRate:
 *                 type: integer
 *                 description: Respiratory rate (breaths per minute) (5-60)
 *                 example: 16
 *               recordedDate:
 *                 type: string
 *                 format: date
 *                 description: Date when vitals were recorded (YYYY-MM-DD)
 *                 example: "2026-04-27"
 *               recordedTime:
 *                 type: string
 *                 description: Time when vitals were recorded (HH:MM format)
 *                 example: "10:30"
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *                 example: "Patient felt dizzy during measurement"
 *     responses:
 *       200:
 *         description: Vital sign record updated
 *       404:
 *         description: Vital sign not found
 */
router.put(
  '/:vitalSignId',
  authenticate,
  requirePermission('vital-signs.update'),
  validate([...vitalSignIdValidator, ...updateVitalSignValidator]),
  vitalSignController.updateVitalSign
);

/**
 * @swagger
 * /vital-signs/{vitalSignId}:
 *   delete:
 *     summary: Delete vital sign record
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vitalSignId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vital sign record deleted
 *       404:
 *         description: Vital sign not found
 */
router.delete(
  '/:vitalSignId',
  authenticate,
  requirePermission('vital-signs.delete'),
  validate(vitalSignIdValidator),
  vitalSignController.deleteVitalSign
);

export default router;