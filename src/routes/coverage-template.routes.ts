import { Router } from 'express';
import { insurancePlanController } from '../controllers/insurance-plan.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { coverageTemplatePayloadValidator } from '../validators/insurance-plan.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /coverage-templates:
 *   get:
 *     summary: Get all coverage templates
 *     tags: [Coverage Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of coverage templates
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
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       coverageRules:
 *                         type: object
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  insurancePlanController.getCoverageTemplates.bind(insurancePlanController)
);

/**
 * @swagger
 * /coverage-templates:
 *   post:
 *     summary: Create new coverage template
 *     tags: [Coverage Templates]
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
 *               coverageRules:
 *                 type: object
 *                 description: JSON object defining coverage percentages and limits
 *     responses:
 *       201:
 *         description: Coverage template created
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  '/',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(coverageTemplatePayloadValidator),
  insurancePlanController.createCoverageTemplate.bind(insurancePlanController)
);

export default router;