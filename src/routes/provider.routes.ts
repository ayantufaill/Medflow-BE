import { Router } from 'express';
import { providerController } from '../controllers/provider.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  providerIdValidator, createProviderValidator,
  updateProviderValidator, providerQueryValidator,
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
 *       200: { description: List of providers }
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
 *             required: [firstName, lastName, specialty]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               specialty: { type: string }
 *     responses:
 *       201: { description: Provider created }
 *       403: { description: Forbidden }
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
 *       200: { description: List of specialties }
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
 *     responses:
 *       200: { description: Provider details }
 *       404: { description: Not found }
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
 *     responses:
 *       200: { description: Provider updated }
 *       403: { description: Forbidden }
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
 *     responses:
 *       200: { description: Provider deleted }
 *       403: { description: Forbidden }
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
 *     responses:
 *       200: { description: Provider activated }
 *       403: { description: Forbidden }
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
 *     responses:
 *       200: { description: Provider deactivated }
 *       403: { description: Forbidden }
 */
router.patch('/:providerId/deactivate', requireRoles('Admin'), validate(providerIdValidator), providerController.deactivateProvider.bind(providerController));

export default router;