import { Router } from 'express';
import { medicationController } from '../controllers/medication.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  medicationIdValidator,
  medicationSearchValidator,
  createMedicationValidator,
  updateMedicationValidator,
} from '../validators/medication.validator';

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate);

/**
 * @swagger
 * /medications:
 *   get:
 *     summary: Retrieve all medications with optional autocomplete search
 *     tags: [Medications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search query for auto-completing medication names (case-insensitive)
 *     responses:
 *       200:
 *         description: List of medications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       genericName:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 */
router.get('/', validate(medicationSearchValidator), medicationController.getMedications.bind(medicationController));

/**
 * @swagger
 * /medications:
 *   post:
 *     summary: Create a new medication (Admin only)
 *     tags: [Medications]
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: Unique name of the medication
 *               genericName:
 *                 type: string
 *                 description: Name or ID of the parent generic medication
 *               notes:
 *                 type: string
 *                 description: Optional notes/descriptions
 *               rxCui:
 *                 type: integer
 *                 description: Optional RxCui identification code
 *               isActive:
 *                 type: boolean
 *                 description: Active status flag (defaults to true)
 *     responses:
 *       201:
 *         description: Medication created successfully
 *       400:
 *         description: Validation error or bad request
 *       409:
 *         description: Medication name already exists
 */
router.post('/', requireRoles('Admin'), validate(createMedicationValidator), medicationController.createMedication.bind(medicationController));

/**
 * @swagger
 * /medications/{id}:
 *   get:
 *     summary: Retrieve single medication by ID or name
 *     tags: [Medications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Medication ID (BigInt) or unique medication name
 *     responses:
 *       200:
 *         description: Medication details
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
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     genericName:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     notes:
 *                       type: string
 *                     rxCui:
 *                       type: string
 *       404:
 *         description: Medication not found
 */
router.get('/:id', validate(medicationIdValidator), medicationController.getMedicationById.bind(medicationController));

/**
 * @swagger
 * /medications/{id}:
 *   patch:
 *     summary: Update an existing medication (Admin only)
 *     tags: [Medications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Medication ID (BigInt) or unique medication name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               genericName:
 *                 type: string
 *               notes:
 *                 type: string
 *               rxCui:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Medication updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Medication not found
 *       409:
 *         description: Medication name conflict
 */
router.patch('/:id', requireRoles('Admin'), validate(updateMedicationValidator), medicationController.updateMedication.bind(medicationController));

export default router;
