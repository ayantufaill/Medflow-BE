import { Router } from 'express';
import { allergyController } from '../controllers/allergy.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
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
router.use(resolveBranchAccess);
router.use(enterTenantContext);

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
 *               - allergyName
 *             properties:
 *               patientId:
 *                 type: integer
 *                 example: 1001
 *               allergyName:
 *                 type: string
 *                 example: Penicillin
 *               reaction:
 *                 type: string
 *                 example: Hives, difficulty breathing
 *               severity:
 *                 type: string
 *                 enum: [mild, moderate, severe]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Allergy created
 *       400:
 *         description: Invalid input
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
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: List of allergies
 *       400:
 *         description: patientId is required
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
 *         schema: { type: integer }
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
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allergyName:
 *                 type: string
 *               reaction:
 *                 type: string
 *               severity:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Allergy updated
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
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Allergy deleted
 *       404:
 *         description: Allergy not found
 */
router.delete(
  '/:id',
  validate(allergyIdValidator),
  allergyController.deleteAllergy.bind(allergyController)
);

export default router;