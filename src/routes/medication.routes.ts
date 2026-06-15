import { Router } from 'express';
import { medicationController } from '../controllers/medication.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { medicationIdValidator, medicationSearchValidator } from '../validators/medication.validator';

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
 *     responses:
 *       200:
 *         description: List of medications
 */
router.get('/', validate(medicationSearchValidator), medicationController.getMedications.bind(medicationController));

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
 *     responses:
 *       200:
 *         description: Medication details
 *       404:
 *         description: Medication not found
 */
router.get('/:id', validate(medicationIdValidator), medicationController.getMedicationById.bind(medicationController));

export default router;
