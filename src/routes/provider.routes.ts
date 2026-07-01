import { Router } from 'express';
import { providerController } from '../controllers/provider.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  providerIdValidator, createProviderValidator,
  updateProviderValidator, providerQueryValidator,
  providerAvailabilityQueryValidator,
} from '../validators/provider.validator';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /providers:
 *   get:
 *     summary: Get all providers
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: specialty
 *         schema: { type: string }
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *     responses:
 *       200: 
 *         description: List of providers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array }
 *   post:
 *     summary: Create a provider (Admin only)
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, specialty, userId, npiNumber]
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: Provider's first name
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 description: Provider's last name
 *                 example: "Doe"
 *               specialty:
 *                 type: string
 *                 description: Medical specialty
 *                 example: "Cardiology"
 *               userId:
 *                 type: string
 *                 description: User ID associated with the provider
 *                 example: "user123"
 *               npiNumber:
 *                 type: string
 *                 description: NPI (National Provider Identifier) number
 *                 example: "1234567890"
 *     responses:
 *       201:
 *         description: Provider created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       400:
 *         description: Bad request - Missing required fields
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/', validate(providerQueryValidator), providerController.getAllProviders.bind(providerController));
router.post('/', requireRoles('Admin'), validate(createProviderValidator), providerController.createProvider.bind(providerController));

/**
 * @swagger
 * /providers/specialties:
 *   get:
 *     summary: Get all specialties
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: 
 *         description: List of specialties
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array }
 */
router.get('/specialties', providerController.getSpecialties.bind(providerController));

/**
 * @swagger
 * /providers/{providerId}:
 *   get:
 *     summary: Get provider by ID
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *         description: Provider ID
 *     responses:
 *       200: 
 *         description: Provider details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       404: 
 *         description: Not found
 *   put:
 *     summary: Update provider (Admin only)
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *         description: Provider ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: Provider's first name
 *                 example: "Jane"
 *               lastName:
 *                 type: string
 *                 description: Provider's last name
 *                 example: "Smith"
 *               specialty:
 *                 type: string
 *                 description: Medical specialty
 *                 example: "Neurology"
 *               userId:
 *                 type: string
 *                 description: User ID associated with the provider
 *                 example: "user456"
 *               npiNumber:
 *                 type: string
 *                 description: NPI (National Provider Identifier) number
 *                 example: "9876543210"
 *             example:
 *               firstName: "Jane"
 *               lastName: "Smith"
 *               specialty: "Neurology"
 *               userId: "user456"
 *               npiNumber: "9876543210"
 *     responses:
 *       200: 
 *         description: Provider updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       400: 
 *         description: Bad request - Invalid data or missing body
 *       403: 
 *         description: Forbidden - Admin access required
 *       404: 
 *         description: Provider not found
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete provider (Admin only)
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *         description: Provider ID
 *     responses:
 *       200: 
 *         description: Provider deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *               example:
 *                 success: true
 *                 message: "Provider deleted successfully"
 *       403: 
 *         description: Forbidden - Admin access required
 *       404: 
 *         description: Provider not found
 *       409:
 *         description: Conflict - Cannot delete provider with existing appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 error:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *               example:
 *                 success: false
 *                 error:
 *                   message: "Cannot delete provider with existing appointments. Please reassign or cancel all appointments first."
 *       500:
 *         description: Internal server error
 */
router.get('/:providerId', validate(providerIdValidator), providerController.getProviderById.bind(providerController));
router.put('/:providerId', requireRoles('Admin'), validate([...providerIdValidator, ...updateProviderValidator]), providerController.updateProvider.bind(providerController));
router.delete('/:providerId', requireRoles('Admin'), validate(providerIdValidator), providerController.deleteProvider.bind(providerController));

/**
 * @swagger
 * /providers/{providerId}/activate:
 *   patch:
 *     summary: Activate provider (Admin only)
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *         description: Provider ID
 *     responses:
 *       200: 
 *         description: Provider activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       403: 
 *         description: Forbidden - Admin access required
 *       404: 
 *         description: Provider not found
 */
router.patch('/:providerId/activate', requireRoles('Admin'), validate(providerIdValidator), providerController.activateProvider.bind(providerController));

/**
 * @swagger
 * /providers/{providerId}/deactivate:
 *   patch:
 *     summary: Deactivate provider (Admin only)
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *         description: Provider ID
 *     responses:
 *       200: 
 *         description: Provider deactivated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       403: 
 *         description: Forbidden - Admin access required
 *       404: 
 *         description: Provider not found
 */
router.patch('/:providerId/deactivate', requireRoles('Admin'), validate(providerIdValidator), providerController.deactivateProvider.bind(providerController));

/**
 * @swagger
 * /providers/{providerId}/availability:
 *   get:
 *     summary: Get provider availability slots
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: durationMinutes
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of available time slots }
 *       404: { description: Provider not found }
 */
router.get(
  '/:providerId/availability',
  validate([...providerIdValidator, ...providerAvailabilityQueryValidator]),
  providerController.getProviderAvailability.bind(providerController)
);

export default router;