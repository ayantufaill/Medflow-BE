import { Router } from 'express';
import { depositController } from '../controllers/deposit.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  depositIdValidator,
  patientIdParamValidator,
  depositSearchValidator,
  createDepositValidator,
  createDepositSlipValidator,
} from '../validators/deposit.validator';

const router = Router();

/**
 * @swagger
 * /deposits:
 *   get:
 *     summary: Get all deposits
 *     tags: [Deposits]
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
 *         description: List of deposits
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('deposits.read'),
  validate(depositSearchValidator),
  depositController.getAllDeposits.bind(depositController)
);

/**
 * @swagger
 * /deposits/slips:
 *   get:
 *     summary: Get all deposit slips
 *     tags: [Deposits]
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
 *         description: List of deposit slips
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/slips',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('deposits.read'),
  validate(depositSearchValidator),
  depositController.getAllDepositSlips.bind(depositController)
);

/**
 * @swagger
 * /deposits/slips/un-deposited:
 *   get:
 *     summary: Get all un-deposited patient and insurance payments
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of un-deposited patient and insurance payments
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/slips/un-deposited',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('deposits.read'),
  depositController.getUnDepositedPayments.bind(depositController)
);

/**
 * @swagger
 * /deposits/slips:
 *   post:
 *     summary: Create a new deposit slip
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankAccountInfo:
 *                 type: string
 *               memo:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               patientPaymentIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               insurancePaymentIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Deposit slip created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/slips',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('deposits.create'),
  validate(createDepositSlipValidator),
  depositController.createDepositSlip.bind(depositController)
);

/**
 * @swagger
 * /deposits/patient/{patientId}:
 *   get:
 *     summary: Get deposits by patient
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of deposits for the patient
 */
router.get(
  '/patient/:patientId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('deposits.read'),
  validate(patientIdParamValidator),
  depositController.getDepositsByPatient.bind(depositController)
);

/**
 * @swagger
 * /deposits/{depositId}:
 *   get:
 *     summary: Get deposit by ID
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: depositId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deposit details
 *       404:
 *         description: Deposit not found
 */
router.get(
  '/:depositId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('deposits.read'),
  validate(depositIdValidator),
  depositController.getDepositById.bind(depositController)
);

/**
 * @swagger
 * /deposits:
 *   post:
 *     summary: Create new deposit
 *     tags: [Deposits]
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
 *               - amount
 *               - paymentMethod
 *               - depositType
 *             properties:
 *               patientId:
 *                 type: integer
 *               amount:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, check, card, ach, insurance]
 *               depositType:
 *                 type: string
 *                 enum: [patient, insurance]
 *               date:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Deposit created
 *       400:
 *         description: Invalid input
 */
router.post(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('deposits.create'),
  validate(createDepositValidator),
  depositController.createDeposit.bind(depositController)
);

export default router;
