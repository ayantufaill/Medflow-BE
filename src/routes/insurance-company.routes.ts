import { Router } from 'express';
import { insuranceCompanyController } from '../controllers/insurance-company.controller';
import { carrierMatchingController } from '../controllers/carrier-matching.controller';
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

// Converted Carriers Matching routes
/**
 * @swagger
 * /insurance-companies/converted/old-payers:
 *   get:
 *     summary: Get converted old-payers
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/converted/old-payers', carrierMatchingController.getConvertedOldPayers.bind(carrierMatchingController));
/**
 * @swagger
 * /insurance-companies/converted/oryx-payers:
 *   get:
 *     summary: Get converted oryx-payers
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/converted/oryx-payers', carrierMatchingController.getConvertedOryxPayers.bind(carrierMatchingController));
/**
 * @swagger
 * /insurance-companies/converted/matched:
 *   get:
 *     summary: Get converted matched
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/converted/matched', carrierMatchingController.getConvertedMatchedPayers.bind(carrierMatchingController));
/**
 * @swagger
 * /insurance-companies/converted/match:
 *   post:
 *     summary: Post converted match
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/converted/match', carrierMatchingController.matchConvertedCarrier.bind(carrierMatchingController));
/**
 * @swagger
 * /insurance-companies/converted/match/{oldPayerId}:
 *   delete:
 *     summary: Delete converted match :oldPayerId
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: oldPayerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.delete('/converted/match/:oldPayerId', carrierMatchingController.deleteConvertedMatch.bind(carrierMatchingController));
/**
 * @swagger
 * /insurance-companies/converted/fetch-matches:
 *   post:
 *     summary: Post converted fetch-matches
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/converted/fetch-matches', carrierMatchingController.fetchMatches.bind(carrierMatchingController));

// Vyne Carriers Matching routes
/**
 * @swagger
 * /insurance-companies/vyne/office-payers:
 *   get:
 *     summary: Get vyne office-payers
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/vyne/office-payers', carrierMatchingController.getVyneOfficePayers.bind(carrierMatchingController));
/**
 * @swagger
 * /insurance-companies/vyne/payers:
 *   get:
 *     summary: Get vyne payers
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/vyne/payers', carrierMatchingController.getVynePayers.bind(carrierMatchingController));
/**
 * @swagger
 * /insurance-companies/vyne/matched:
 *   get:
 *     summary: Get vyne matched
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/vyne/matched', carrierMatchingController.getVyneMatchedPayers.bind(carrierMatchingController));
/**
 * @swagger
 * /insurance-companies/vyne/match:
 *   post:
 *     summary: Post vyne match
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/vyne/match', carrierMatchingController.matchVyneCarrier.bind(carrierMatchingController));
/**
 * @swagger
 * /insurance-companies/vyne/match/{officePayerId}:
 *   delete:
 *     summary: Delete vyne match :officePayerId
 *     tags: [Insurance Company]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: officePayerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.delete('/vyne/match/:officePayerId', carrierMatchingController.deleteVyneMatch.bind(carrierMatchingController));

export default router;