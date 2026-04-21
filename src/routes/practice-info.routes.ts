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