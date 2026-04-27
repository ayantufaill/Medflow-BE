import { Router } from 'express';
import { allergyController } from '../controllers/allergy.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createAllergyValidator,
  updateAllergyValidator,
  allergyIdValidator,
  getAllergiesQueryValidator,
} from '../validators/allergy.validator';

const router = Router();

// All allergy routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /allergies:
 *   post:
 *     summary: Create new allergy record
 *     tags: [Allergies]
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
 *               - allergen
 *               - reaction
 *               - severity
 *               - documentedDate
 *             properties:
 *               patientId:
 *                 type: integer
 *                 example: 1
 *                 description: Patient ID (required)
 *               allergen:
 *                 type: string
 *                 example: Penicillin
 *                 description: Name of the allergen (required)
 *               reaction:
 *                 type: string
 *                 example: Hives, difficulty breathing
 *                 description: Reaction to the allergen (required)
 *               severity:
 *                 type: string
 *                 enum: [mild, moderate, severe]
 *                 example: mild
 *                 description: Severity level (required)
 *               documentedDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-04-25
 *                 description: Date when allergy was documented (required)
 *               notes:
 *                 type: string
 *                 example: Patient has known reaction
 *                 description: Additional notes (optional)
 *           example:
 *             patientId: 1
 *             allergen: Penicillin
 *             reaction: Hives, difficulty breathing
 *             severity: mild
 *             documentedDate: 2026-04-25
 *             notes: Patient has known reaction
 *     responses:
 *       201:
 *         description: Allergy created
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
 *         description: Invalid input - Missing required fields (patientId, allergen, reaction, severity, documentedDate)
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.post(
  '/',
  validate(createAllergyValidator),
  allergyController.createAllergy.bind(allergyController)
);

/**
 * @swagger
 * /allergies:
 *   get:
 *     summary: Get all allergies for a patient
 *     tags: [Allergies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patient_id
 *         required: true
 *         schema: 
 *           type: integer
 *         description: Patient ID (use patient_id, not patientId)
 *         example: 1
 *     responses:
 *       200:
 *         description: List of allergies
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
 *       400:
 *         description: patient_id is required
 */
router.get(
  '/',
  validate(getAllergiesQueryValidator),
  allergyController.getAllergies.bind(allergyController)
);

/**
 * @swagger
 * /allergies/{id}:
 *   get:
 *     summary: Get allergy by ID
 *     tags: [Allergies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: 
 *           type: integer
 *         description: Allergy ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Allergy details
 *       404:
 *         description: Allergy not found
 */
router.get(
  '/:id',
  validate(allergyIdValidator),
  allergyController.getAllergyById.bind(allergyController)
);

/**
 * @swagger
 * /allergies/{id}:
 *   put:
 *     summary: Update allergy record
 *     tags: [Allergies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: 
 *           type: integer
 *         description: Allergy ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allergen:
 *                 type: string
 *                 example: Amoxicillin
 *               reaction:
 *                 type: string
 *                 example: Skin rash
 *               severity:
 *                 type: string
 *                 enum: [mild, moderate, severe]
 *                 example: moderate
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               notes:
 *                 type: string
 *                 example: Updated reaction notes
 *     responses:
 *       200:
 *         description: Allergy updated
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Allergy not found
 */
router.put(
  '/:id',
  validate([...allergyIdValidator, ...updateAllergyValidator]),
  allergyController.updateAllergy.bind(allergyController)
);

/**
 * @swagger
 * /allergies/{id}:
 *   delete:
 *     summary: Delete allergy (soft delete)
 *     tags: [Allergies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: 
 *           type: integer
 *         description: Allergy ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Allergy deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Allergy not found
 */
router.delete(
  '/:id',
  validate(allergyIdValidator),
  allergyController.deleteAllergy.bind(allergyController)
);

export default router;