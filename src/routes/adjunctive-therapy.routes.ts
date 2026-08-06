import { Router } from 'express';
import { adjunctiveTherapyController } from '../controllers/adjunctive-therapy.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { validate } from '../middleware/validation.middleware';
import { patientIdParamValidator, saveAdjunctiveTherapyValidator } from '../validators/adjunctive-therapy.validator';

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate);
router.use(resolveBranchAccess);
router.use(enterTenantContext);

/**
 * @swagger
 * /patients/{patientId}/adjunctive-therapy:
 *   get:
 *     summary: Get patient adjunctive therapy prescriptions
 *     tags: [Adjunctive Therapy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Adjunctive therapy details
 *       404:
 *         description: Patient not found
 */
router.get('/:patientId/adjunctive-therapy', validate(patientIdParamValidator), adjunctiveTherapyController.getPatientAdjunctiveTherapy.bind(adjunctiveTherapyController));

/**
 * @swagger
 * /patients/{patientId}/adjunctive-therapy:
 *   post:
 *     summary: Prescribe adjunctive therapy items for a patient
 *     tags: [Adjunctive Therapy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               products: { type: array, items: { type: string } }
 *               labFees: { type: array, items: { type: string } }
 *               hygieneTools: { type: array, items: { type: string } }
 *               fluoride: { type: object }
 *               toothbrush: { type: object }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Adjunctive therapy saved successfully
 */
router.post('/:patientId/adjunctive-therapy', validate([...patientIdParamValidator, ...saveAdjunctiveTherapyValidator]), adjunctiveTherapyController.savePatientAdjunctiveTherapy.bind(adjunctiveTherapyController));

export default router;
