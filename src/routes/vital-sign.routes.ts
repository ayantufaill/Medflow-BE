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
  vitalSignNormalRangesValidator,
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
 *         description: Normal range thresholds for vital sign metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     normalRanges:
 *                       type: object
 *                       properties:
 *                         bloodPressureSystolic: { type: object }
 *                         bloodPressureDiastolic: { type: object }
 *                         temperature: { type: object }
 *                         weight: { type: object }
 *                         height: { type: object }
 *                         heartRate: { type: object }
 *                         respiratoryRate: { type: object }
 *                         oxygenSaturation: { type: object }
 *                         bmi: { type: object }
 *       400:
 *         description: Invalid input query parameters
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
 *               appointmentId:
 *                 type: integer
 *               height:
 *                 type: number
 *               weight:
 *                 type: number
 *               bloodPressureSystolic:
 *                 type: integer
 *               bloodPressureDiastolic:
 *                 type: integer
 *               pulse:
 *                 type: integer
 *               temperature:
 *                 type: number
 *               respiratoryRate:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vital sign record created
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
 *               weight:
 *                 type: number
 *               bloodPressureSystolic:
 *                 type: integer
 *               bloodPressureDiastolic:
 *                 type: integer
 *               pulse:
 *                 type: integer
 *               temperature:
 *                 type: number
 *               respiratoryRate:
 *                 type: integer
 *               notes:
 *                 type: string
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