import { Router } from 'express';
import { payPlanController } from '../controllers/payplan.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  payPlanIdValidator,
  patientIdParamValidator,
  payPlanSearchValidator,
  createPayPlanValidator,
  updatePayPlanValidator,
} from '../validators/payplan.validator';

const router = Router();

/**
 * @swagger
 * /payment-plans:
 *   get:
 *     summary: Get all payment plans
 *     tags: [Payment Plans]
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
 *         name: patientId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of payment plans
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('payment-plans.read'),
  validate(payPlanSearchValidator),
  payPlanController.getAllPayPlans.bind(payPlanController)
);

/**
 * @swagger
 * /payment-plans/patient/{patientId}:
 *   get:
 *     summary: Get payment plans by patient
 *     tags: [Payment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of payment plans for the patient
 */
router.get(
  '/patient/:patientId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('payment-plans.read'),
  validate(patientIdParamValidator),
  payPlanController.getPayPlansByPatient.bind(payPlanController)
);

/**
 * @swagger
 * /payment-plans/{payPlanId}:
 *   get:
 *     summary: Get payment plan by ID
 *     tags: [Payment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payPlanId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Payment plan details
 *       404:
 *         description: Payment plan not found
 */
router.get(
  '/:payPlanId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('payment-plans.read'),
  validate(payPlanIdValidator),
  payPlanController.getPayPlanById.bind(payPlanController)
);

/**
 * @swagger
 * /payment-plans:
 *   post:
 *     summary: Create new payment plan
 *     tags: [Payment Plans]
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
 *               - totalAmount
 *             properties:
 *               patientId:
 *                 type: integer
 *               totalAmount:
 *                 type: number
 *               downPayment:
 *                 type: number
 *               monthlyPayment:
 *                 type: number
 *               numberOfPayments:
 *                 type: integer
 *               apr:
 *                 type: number
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment plan created
 *       400:
 *         description: Invalid input
 */
router.post(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('payment-plans.create'),
  validate(createPayPlanValidator),
  payPlanController.createPayPlan.bind(payPlanController)
);

/**
 * @swagger
 * /payment-plans/{payPlanId}:
 *   patch:
 *     summary: Update payment plan
 *     tags: [Payment Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payPlanId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isClosed:
 *                 type: boolean
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment plan updated
 *       404:
 *         description: Payment plan not found
 */
router.patch(
  '/:payPlanId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('payment-plans.update'),
  validate([...payPlanIdValidator, ...updatePayPlanValidator]),
  payPlanController.updatePayPlan.bind(payPlanController)
);

export default router;
