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
 *         name: insuranceCompanyId
 *         schema: { type: integer }
 *         description: Filter by insurance company ID
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
 *               - insuranceCompanyId
 *             properties:
 *               name:
 *                 type: string
 *                 description: Insurance plan name
 *                 example: "PPO Gold"
 *               insuranceCompanyId:
 *                 type: integer
 *                 description: Insurance company ID (must be a valid company ID, not 0)
 *                 example: 1
 *               groupNumber:
 *                 type: string
 *                 description: Group number for the plan
 *                 example: "GRP-12345"
 *               coverageDetails:
 *                 type: object
 *                 description: Coverage details and rules
 *                 example: {
 *                   "deductible": 1000,
 *                   "copay": 25,
 *                   "coinsurance": 80
 *                 }
 *     responses:
 *       201:
 *         description: Insurance plan created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input - missing required fields or invalid company ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Insurance company not found
 *       409:
 *         description: Insurance plan already exists
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
 *                 description: Template name
 *                 example: "Standard Health Coverage"
 *               coverageRules:
 *                 type: object
 *                 description: Coverage rules
 *                 example: {
 *                   "primaryCare": 80,
 *                   "specialist": 70,
 *                   "emergency": 60
 *                 }
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
 *         example: 1
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
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Insurance plan name
 *                 example: "PPO Platinum"
 *               groupNumber:
 *                 type: string
 *                 description: Group number
 *                 example: "GRP-67890"
 *               isActive:
 *                 type: boolean
 *                 description: Whether the plan is active
 *                 example: true
 *               coverageDetails:
 *                 type: object
 *                 description: Coverage details
 *                 example: {
 *                   "deductible": 500,
 *                   "copay": 20,
 *                   "coinsurance": 85
 *                 }
 *     responses:
 *       200:
 *         description: Insurance plan updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Plan not found
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
 *         example: 1
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
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - insuranceCompanyId
 *               - insuranceType
 *               - policyNumber
 *               - subscriberName
 *               - subscriberDateOfBirth
 *               - relationshipToPatient
 *               - effectiveDate
 *             properties:
 *               planId:
 *                 type: integer
 *                 description: Insurance plan ID
 *                 example: 1
 *               insuranceCompanyId:
 *                 type: integer
 *                 description: Insurance company ID
 *                 example: 1
 *               insuranceType:
 *                 type: string
 *                 description: Insurance type (primary, secondary, tertiary)
 *                 enum: [primary, secondary, tertiary]
 *                 example: "primary"
 *               policyNumber:
 *                 type: string
 *                 description: Policy number
 *                 example: "POL-12345678"
 *               groupNumber:
 *                 type: string
 *                 description: Group number
 *                 example: "GRP-98765"
 *               subscriberName:
 *                 type: string
 *                 description: Full name of the subscriber
 *                 example: "John Doe"
 *               subscriberId:
 *                 type: string
 *                 description: Subscriber ID
 *                 example: "SUB-12345"
 *               subscriberDateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: Subscriber's date of birth (YYYY-MM-DD)
 *                 example: "1975-06-15"
 *               relationshipToPatient:
 *                 type: string
 *                 description: Relationship to patient
 *                 enum: [self, spouse, child, other]
 *                 example: "self"
 *               effectiveDate:
 *                 type: string
 *                 format: date
 *                 description: Coverage effective date (YYYY-MM-DD)
 *                 example: "2026-01-01"
 *               expirationDate:
 *                 type: string
 *                 format: date
 *                 description: Coverage expiration date (YYYY-MM-DD)
 *                 example: "2026-12-31"
 *               isPrimary:
 *                 type: boolean
 *                 description: Whether this is the primary insurance
 *                 example: true
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *                 example: "Family plan with $500 deductible"
 *     responses:
 *       201:
 *         description: Patient coverage added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input - missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Patient or plan not found
 */
router.post(
  '/patients/:patientId/coverages',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate([...patientIdValidator, ...createPatientInsuranceValidator]),
  insurancePlanController.createPatientCoverage.bind(insurancePlanController)
);

export default router;