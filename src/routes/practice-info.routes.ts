import { Router } from 'express';
import { practiceInfoController } from '../controllers/practice-info.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { validateFormData } from '../middleware/formDataValidation.middleware';
import { uploadLogo } from '../middleware/upload.middleware';
import {
  createPracticeInfoValidator,
  updatePracticeInfoValidator,
  practiceInfoIdValidator,
  queryValidator,
} from '../validators/practice-info.validator';

const router = Router();

// All practice info routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /practice-info:
 *   get:
 *     summary: Get all practice info records (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of practice info records
 *       403:
 *         description: Admin only
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  requireRoles('Admin'),
  validate(queryValidator),
  practiceInfoController.getAllPracticeInfo.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/current:
 *   get:
 *     summary: Get current practice info (most recent)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current practice information
 */
router.get(
  '/current',
  requireRoles('Admin'),
  practiceInfoController.getPracticeInfo.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}:
 *   get:
 *     summary: Get practice info by ID (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Practice info details
 *       404:
 *         description: Practice info not found
 */
router.get(
  '/:practiceInfoId',
  requireRoles('Admin'),
  validate(practiceInfoIdValidator),
  practiceInfoController.getPracticeInfoById.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info:
 *   post:
 *     summary: Create practice info (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - practiceName
 *             properties:
 *               practiceName:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               website:
 *                 type: string
 *               logo:
 *                 type: string
 *                 format: binary
 *               taxId:
 *                 type: string
 *               npi:
 *                 type: string
 *     responses:
 *       201:
 *         description: Practice info created
 */
router.post(
  '/',
  requireRoles('Admin'),
  uploadLogo.single('logo'),
  validateFormData(createPracticeInfoValidator),
  practiceInfoController.createPracticeInfo.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}:
 *   put:
 *     summary: Update practice info (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               practiceName:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               website:
 *                 type: string
 *               logo:
 *                 type: string
 *                 format: binary
 *               taxId:
 *                 type: string
 *               npi:
 *                 type: string
 *     responses:
 *       200:
 *         description: Practice info updated
 *       404:
 *         description: Practice info not found
 */
router.put(
  '/:practiceInfoId',
  requireRoles('Admin'),
  uploadLogo.single('logo'),
  validateFormData([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updatePracticeInfo.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/opening-hours:
 *   patch:
 *     summary: Update practice opening hours (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessHours:
 *                 type: object
 *     responses:
 *       200:
 *         description: Opening hours updated
 */
router.patch(
  '/:practiceInfoId/opening-hours',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updateOpeningHours.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/billing-config:
 *   patch:
 *     summary: Update practice billing configuration (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               billingOutOfNetwork:
 *                 type: string
 *                 enum: [yes, no]
 *               billingAssignmentType:
 *                 type: string
 *                 enum: [in-assignment, non-assignment]
 *               billingProvider:
 *                 type: string
 *                 enum: [default, treating, business]
 *     responses:
 *       200:
 *         description: Billing configuration updated
 */
router.patch(
  '/:practiceInfoId/billing-config',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updateBillingConfig.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/kiosk-settings:
 *   patch:
 *     summary: Update kiosk settings (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               kioskPassword:
 *                 type: string
 *               kioskAccounts:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Kiosk settings updated
 */
router.patch(
  '/:practiceInfoId/kiosk-settings',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updateKioskSettings.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/mychart-settings:
 *   patch:
 *     summary: Update MyChart configuration (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               myChartSettings:
 *                 type: object
 *     responses:
 *       200:
 *         description: MyChart settings updated
 */
router.patch(
  '/:practiceInfoId/mychart-settings',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updateMyChartSettings.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/office-timings:
 *   patch:
 *     summary: Update office timings (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               officeTimings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Office timings updated
 */
router.patch(
  '/:practiceInfoId/office-timings',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updateOfficeTimings.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/online-schedule:
 *   patch:
 *     summary: Update online schedule configuration (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               onlineSchedule:
 *                 type: object
 *     responses:
 *       200:
 *         description: Online schedule updated
 */
router.patch(
  '/:practiceInfoId/online-schedule',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updateOnlineSchedule.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/patient-flags:
 *   patch:
 *     summary: Update patient flags (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientFlags:
 *                 type: array
 *     responses:
 *       200:
 *         description: Patient flags updated
 */
router.patch(
  '/:practiceInfoId/patient-flags',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updatePatientFlags.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/document-categories:
 *   patch:
 *     summary: Update document categories (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentCategories:
 *                 type: array
 *     responses:
 *       200:
 *         description: Document categories updated
 */
router.patch(
  '/:practiceInfoId/document-categories',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updateDocumentCategories.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/schedule-config:
 *   patch:
 *     summary: Update schedule configuration (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduleConfig:
 *                 type: object
 *     responses:
 *       200:
 *         description: Schedule configuration updated
 */
router.patch(
  '/:practiceInfoId/schedule-config',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updateScheduleConfig.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}/practice-settings:
 *   patch:
 *     summary: Update practice settings (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               practiceSettings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Practice settings updated
 */
router.patch(
  '/:practiceInfoId/practice-settings',
  requireRoles('Admin'),
  validate([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updatePracticeSettings.bind(practiceInfoController)
);

/**
 * @swagger
 * /practice-info/{practiceInfoId}:
 *   delete:
 *     summary: Delete practice info (Admin only)
 *     tags: [Practice Info]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: practiceInfoId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Practice info deleted
 *       404:
 *         description: Practice info not found
 */
router.delete(
  '/:practiceInfoId',
  requireRoles('Admin'),
  validate(practiceInfoIdValidator),
  practiceInfoController.deletePracticeInfo.bind(practiceInfoController)
);

export default router;