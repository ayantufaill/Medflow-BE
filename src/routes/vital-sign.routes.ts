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
  dateFilterQueryValidator,
  vitalSignNormalRangesValidator,
} from '../validators/vital-sign.validator';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VitalSign:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *           description: Unique identifier
 *         patientId:
 *           type: integer
 *           example: 1
 *           description: ID of the patient
 *         appointmentId:
 *           type: integer
 *           nullable: true
 *           example: 5
 *           description: Associated appointment ID
 *         dateTaken:
 *           type: string
 *           format: date-time
 *           example: "2024-06-12T09:00:00Z"
 *           description: Date and time vitals were taken
 *         height:
 *           type: number
 *           format: float
 *           example: 175.5
 *           description: Height in centimeters
 *         weight:
 *           type: number
 *           format: float
 *           example: 72.3
 *           description: Weight in kilograms
 *         bmi:
 *           type: number
 *           format: float
 *           example: 23.5
 *           description: Body Mass Index (calculated)
 *         bloodPressureSystolic:
 *           type: integer
 *           example: 120
 *           description: Blood pressure systolic reading (mmHg)
 *         bloodPressureDiastolic:
 *           type: integer
 *           example: 80
 *           description: Blood pressure diastolic reading (mmHg)
 *         heartRate:
 *           type: integer
 *           example: 72
 *           description: Heart rate in beats per minute (bpm)
 *         temperature:
 *           type: number
 *           format: float
 *           example: 98.6
 *           description: Body temperature in Fahrenheit
 *         respiratoryRate:
 *           type: integer
 *           example: 16
 *           description: Respiratory rate per minute
 *         oxygenSaturation:
 *           type: integer
 *           example: 98
 *           description: Blood oxygen percentage (SpO2)
 *         notes:
 *           type: string
 *           example: "Patient was resting comfortably"
 *           description: Additional clinical notes
 *         recordedBy:
 *           type: string
 *           example: "Nurse Sarah Mitchell"
 *           description: Name of person who recorded vitals
 *         recordedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-06-12T09:05:00Z"
 *           description: When the record was created
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     VitalSignCreate:
 *       type: object
 *       required:
 *         - patientId
 *       properties:
 *         patientId:
 *           type: integer
 *           example: 1
 *           description: Patient ID (required)
 *         appointmentId:
 *           type: integer
 *           example: 5
 *           description: Associated appointment ID
 *         dateTaken:
 *           type: string
 *           format: date-time
 *           example: "2024-06-12T09:00:00Z"
 *           description: Date and time vitals were taken (defaults to now)
 *         height:
 *           type: number
 *           format: float
 *           example: 175.5
 *         weight:
 *           type: number
 *           format: float
 *           example: 72.3
 *         bloodPressureSystolic:
 *           type: integer
 *           example: 120
 *         bloodPressureDiastolic:
 *           type: integer
 *           example: 80
 *         heartRate:
 *           type: integer
 *           example: 72
 *         temperature:
 *           type: number
 *           format: float
 *           example: 98.6
 *         respiratoryRate:
 *           type: integer
 *           example: 16
 *         oxygenSaturation:
 *           type: integer
 *           example: 98
 *         notes:
 *           type: string
 *         recordedBy:
 *           type: string
 *
 *     VitalSignUpdate:
 *       type: object
 *       properties:
 *         dateTaken:
 *           type: string
 *           format: date-time
 *         height:
 *           type: number
 *           format: float
 *         weight:
 *           type: number
 *           format: float
 *         bloodPressureSystolic:
 *           type: integer
 *         bloodPressureDiastolic:
 *           type: integer
 *         heartRate:
 *           type: integer
 *         temperature:
 *           type: number
 *           format: float
 *         respiratoryRate:
 *           type: integer
 *         oxygenSaturation:
 *           type: integer
 *         notes:
 *           type: string
 *         recordedBy:
 *           type: string
 *
 *     VitalSignsListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             vitalSigns:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VitalSign'
 *             pagination:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *
 *     VitalSignSingleResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             vitalSign:
 *               $ref: '#/components/schemas/VitalSign'
 *
 *     NormalRangesResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             temperature:
 *               type: object
 *               properties:
 *                 min: { type: number }
 *                 max: { type: number }
 *                 unit: { type: string }
 *             bloodPressureSystolic:
 *               type: object
 *               properties:
 *                 min: { type: number }
 *                 max: { type: number }
 *                 unit: { type: string }
 *             bloodPressureDiastolic:
 *               type: object
 *               properties:
 *                 min: { type: number }
 *                 max: { type: number }
 *                 unit: { type: string }
 *             heartRate:
 *               type: object
 *               properties:
 *                 min: { type: number }
 *                 max: { type: number }
 *                 unit: { type: string }
 *             oxygenSaturation:
 *               type: object
 *               properties:
 *                 min: { type: number }
 *                 max: { type: number }
 *                 unit: { type: string }
 *             respiratoryRate:
 *               type: object
 *               properties:
 *                 min: { type: number }
 *                 max: { type: number }
 *                 unit: { type: string }
 */

/**
 * @swagger
 * /vital-signs:
 *   get:
 *     summary: Get all vital signs with pagination and filters
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Items per page
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *         description: Filter by patient ID
 *       - in: query
 *         name: appointmentId
 *         schema: { type: integer }
 *         description: Filter by appointment ID
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Filter by end date
 *     responses:
 *       200:
 *         description: Vital signs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VitalSignsListResponse'
 *       400:
 *         description: Bad request - invalid query parameters
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
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - insufficient permissions
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
 * /vital-signs/normal-ranges:
 *   get:
 *     summary: Get normal range thresholds for vital signs by age and gender
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: age
 *         schema: { type: integer }
 *         description: Patient's age in years
 *       - in: query
 *         name: gender
 *         schema: { type: string, enum: [male, female, other] }
 *         description: Patient's gender
 *     responses:
 *       200:
 *         description: Normal ranges retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NormalRangesResponse'
 *       400:
 *         description: Invalid input query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/normal-ranges',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(vitalSignNormalRangesValidator),
  vitalSignController.getNormalRanges.bind(vitalSignController)
);

/**
 * @swagger
 * /vital-signs/patient/{patientId}:
 *   get:
 *     summary: Get vital signs by patient ID
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         description: Patient ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Items per page
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: End date filter
 *     responses:
 *       200:
 *         description: Patient vital signs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VitalSignsListResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Patient not found
 */
router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('vital-signs.read'),
  validate([...patientIdParamValidator, ...paginationQueryValidator, ...dateFilterQueryValidator]),
  vitalSignController.getVitalSignsByPatient
);

/**
 * @swagger
 * /vital-signs/patient/{patientId}/latest:
 *   get:
 *     summary: Get latest vital signs for a patient
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: Latest vital signs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VitalSignSingleResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Patient not found or no vital signs recorded
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
 *     summary: Get vital signs trend data for a patient
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         description: Patient ID
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *         description: Number of days to look back
 *       - in: query
 *         name: metrics
 *         schema: { type: string }
 *         description: Comma-separated list of metrics (e.g., weight,bp,heartRate)
 *     responses:
 *       200:
 *         description: Vital signs trend data retrieved successfully
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
 *                     vitals:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Patient not found
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
 *     summary: Get vital signs by appointment ID
 *     tags: [Vital Signs]
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
 *         description: Vital signs for appointment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VitalSignSingleResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found or no vital signs recorded
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
 *         description: Vital sign record ID
 *     responses:
 *       200:
 *         description: Vital sign retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VitalSignSingleResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vital sign not found
 */
router.get(
  '/:vitalSignId',
  authenticate,
  requirePermission('vital-signs.read'),
  validate(vitalSignIdValidator),
  vitalSignController.getVitalSignById.bind(vitalSignController)
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
 *             properties:
 *               patientId:
 *                 type: integer
 *                 example: 1
 *                 description: Patient ID (required)
 *               appointmentId:
 *                 type: integer
 *                 example: 5
 *                 description: Associated appointment ID
 *               dateTaken:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-12T09:00:00Z"
 *               height:
 *                 type: number
 *                 format: float
 *                 example: 175.5
 *               weight:
 *                 type: number
 *                 format: float
 *                 example: 72.3
 *               bloodPressureSystolic:
 *                 type: integer
 *                 example: 120
 *               bloodPressureDiastolic:
 *                 type: integer
 *                 example: 80
 *               heartRate:
 *                 type: integer
 *                 example: 72
 *               temperature:
 *                 type: number
 *                 format: float
 *                 example: 98.6
 *               respiratoryRate:
 *                 type: integer
 *                 example: 16
 *               oxygenSaturation:
 *                 type: integer
 *                 example: 98
 *               notes:
 *                 type: string
 *                 example: "Patient was resting comfortably"
 *               recordedBy:
 *                 type: string
 *                 example: "Nurse Sarah Mitchell"
 *     responses:
 *       201:
 *         description: Vital sign record created successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     vitalSign:
 *                       $ref: '#/components/schemas/VitalSign'
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
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Patient not found
 *       422:
 *         description: Validation failed - invalid vital sign values
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
 *         description: Vital sign record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dateTaken:
 *                 type: string
 *                 format: date-time
 *               height:
 *                 type: number
 *                 format: float
 *               weight:
 *                 type: number
 *                 format: float
 *               bloodPressureSystolic:
 *                 type: integer
 *               bloodPressureDiastolic:
 *                 type: integer
 *               heartRate:
 *                 type: integer
 *               temperature:
 *                 type: number
 *                 format: float
 *               respiratoryRate:
 *                 type: integer
 *               oxygenSaturation:
 *                 type: integer
 *               notes:
 *                 type: string
 *               recordedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vital sign record updated successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     vitalSign:
 *                       $ref: '#/components/schemas/VitalSign'
 *       400:
 *         description: Bad request - invalid data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Vital sign not found
 *       422:
 *         description: Validation failed
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
 *     summary: Delete vital sign record (soft delete)
 *     tags: [Vital Signs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vitalSignId
 *         required: true
 *         schema: { type: integer }
 *         description: Vital sign record ID
 *     responses:
 *       200:
 *         description: Vital sign record deleted successfully
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
 *                   example: "Vital sign record deleted successfully"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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