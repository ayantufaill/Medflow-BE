import { Router } from 'express';
import { insuranceCompanyController } from '../controllers/insurance-company.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  insuranceCompanyIdValidator,
  createInsuranceCompanyValidator,
  updateInsuranceCompanyValidator,
} from '../validators/insurance.validator';

const router = Router();

// All insurance company routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /insurance-companies:
 *   get:
 *     summary: Get all insurance companies
 *     tags: [Insurance Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of insurance companies
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
 *                       code:
 *                         type: string
 *                       address:
 *                         type: string
 *                       phone:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/', insuranceCompanyController.getAllInsuranceCompanies.bind(insuranceCompanyController));

/**
 * @swagger
 * /insurance-companies/{insuranceCompanyId}:
 *   get:
 *     summary: Get insurance company by ID
 *     tags: [Insurance Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: insuranceCompanyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Insurance company details
 *       404:
 *         description: Insurance company not found
 */
router.get(
  '/:insuranceCompanyId',
  validate(insuranceCompanyIdValidator),
  insuranceCompanyController.getInsuranceCompanyById.bind(insuranceCompanyController)
);

/**
 * @swagger
 * /insurance-companies:
 *   post:
 *     summary: Create new insurance company (Admin only)
 *     tags: [Insurance Companies]
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
 *                 example: Blue Cross Blue Shield
 *               code:
 *                 type: string
 *                 example: BCBS
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: Insurance company created
 *       403:
 *         description: Admin only
 *       409:
 *         description: Insurance company already exists
 */
router.post(
  '/',
  requireRoles('Admin'),
  validate(createInsuranceCompanyValidator),
  insuranceCompanyController.createInsuranceCompany.bind(insuranceCompanyController)
);

/**
 * @swagger
 * /insurance-companies/{insuranceCompanyId}:
 *   put:
 *     summary: Update insurance company (Admin only)
 *     tags: [Insurance Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: insuranceCompanyId
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
 *               code:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Insurance company updated
 *       403:
 *         description: Admin only
 *       404:
 *         description: Insurance company not found
 */
router.put(
  '/:insuranceCompanyId',
  requireRoles('Admin'),
  validate([...insuranceCompanyIdValidator, ...updateInsuranceCompanyValidator]),
  insuranceCompanyController.updateInsuranceCompany.bind(insuranceCompanyController)
);

/**
 * @swagger
 * /insurance-companies/{insuranceCompanyId}:
 *   delete:
 *     summary: Delete insurance company (Admin only)
 *     tags: [Insurance Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: insuranceCompanyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Insurance company deleted
 *       403:
 *         description: Admin only
 *       404:
 *         description: Insurance company not found
 *       400:
 *         description: Cannot delete company with active plans
 */
router.delete(
  '/:insuranceCompanyId',
  requireRoles('Admin'),
  validate(insuranceCompanyIdValidator),
  insuranceCompanyController.deleteInsuranceCompany.bind(insuranceCompanyController)
);

export default router;