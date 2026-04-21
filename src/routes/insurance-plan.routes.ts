import { Router } from 'express';
import { insurancePlanController } from '../controllers/insurance-plan.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  coverageTemplatePayloadValidator,
  insurancePlanIdValidator,
  insurancePlanPayloadValidator,
  insurancePlanQueryValidator,
  insurancePlanUpdateValidator,
} from '../validators/insurance-plan.validator';
import { patientIdValidator } from '../validators/patient.validator';
import { createPatientInsuranceValidator } from '../validators/insurance.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /insurance-plans:
 *   get:
 *     summary: Get all insurance plans
 *     tags: [Insurance Plans]
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
 *         name: companyId
 *         schema: { type: integer }
 *         description: Filter by insurance company
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of insurance plans
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(insurancePlanQueryValidator),
  insurancePlanController.getInsurancePlans.bind(insurancePlanController)
);

/**
 * @swagger
 * /insurance-plans:
 *   post:
 *     summary: Create new insurance plan
 *     tags: [Insurance Plans]
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
 *               - companyId
 *             properties:
 *               name:
 *                 type: string
 *                 example: PPO Gold
 *               companyId:
 *                 type: integer
 *               groupNumber:
 *                 type: string
 *               coverageDetails:
 *                 type: object
 *     responses:
 *       201:
 *         description: Insurance plan created
 */
router.post(
  '/',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(insurancePlanPayloadValidator),
  insurancePlanController.createInsurancePlan.bind(insurancePlanController)
);

/**
 * @swagger
 * /insurance-plans/coverage-templates:
 *   get:
 *     summary: Get coverage templates
 *     tags: [Insurance Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of coverage templates
 */
router.get(
  '/coverage-templates',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  insurancePlanController.getCoverageTemplates.bind(insurancePlanController)
);

/**
 * @swagger
 * /insurance-plans/coverage-templates:
 *   post:
 *     summary: Create coverage template
 *     tags: [Insurance Plans]
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
 *     responses:
 *       201:
 *         description: Coverage template created
 */
router.post(
  '/coverage-templates',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(coverageTemplatePayloadValidator),
  insurancePlanController.createCoverageTemplate.bind(insurancePlanController)
);

/**
 * @swagger
 * /insurance-plans/{planId}:
 *   get:
 *     summary: Get insurance plan by ID
 *     tags: [Insurance Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Insurance plan details
 *       404:
 *         description: Plan not found
 */
router.get(
  '/:planId',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(insurancePlanIdValidator),
  insurancePlanController.getInsurancePlanById.bind(insurancePlanController)
);

/**
 * @swagger
 * /insurance-plans/{planId}:
 *   patch:
 *     summary: Update insurance plan
 *     tags: [Insurance Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               groupNumber:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               coverageDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Insurance plan updated
 */
router.patch(
  '/:planId',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate([...insurancePlanIdValidator, ...insurancePlanUpdateValidator]),
  insurancePlanController.updateInsurancePlan.bind(insurancePlanController)
);

/**
 * @swagger
 * /insurance-plans/patients/{patientId}/coverages:
 *   get:
 *     summary: Get patient insurance coverages
 *     tags: [Insurance Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Patient insurance coverages
 */
router.get(
  '/patients/:patientId/coverages',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(patientIdValidator),
  insurancePlanController.getPatientCoverages.bind(insurancePlanController)
);

/**
 * @swagger
 * /insurance-plans/patients/{patientId}/coverages:
 *   post:
 *     summary: Add insurance coverage for patient
 *     tags: [Insurance Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: integer
 *               subscriberId:
 *                 type: string
 *               relationship:
 *                 type: string
 *                 enum: [self, spouse, child, other]
 *     responses:
 *       201:
 *         description: Patient coverage added
 */
router.post(
  '/patients/:patientId/coverages',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate([...patientIdValidator, ...createPatientInsuranceValidator]),
  insurancePlanController.createPatientCoverage.bind(insurancePlanController)
);

export default router;