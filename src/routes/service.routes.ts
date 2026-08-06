import { Router } from 'express';
import { serviceController } from '../controllers/service.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  serviceIdValidator,
  serviceSearchValidator,
  createServiceValidator,
  updateServiceValidator,
} from '../validators/service.validator';

const router = Router();

/**
 * @swagger
 * /services:
 *   get:
 *     summary: Get all services
 *     tags: [Services]
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
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of services
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('services.read'),
  validate(serviceSearchValidator),
  serviceController.getAllServices.bind(serviceController)
);

/**
 * @swagger
 * /services/categories:
 *   get:
 *     summary: Get service categories
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of service categories
 */
router.get(
  '/categories',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('services.read'),
  serviceController.getCategories.bind(serviceController)
);

/**
 * @swagger
 * /services/{serviceId}:
 *   get:
 *     summary: Get service by ID
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Service details
 *       404:
 *         description: Service not found
 */
router.get(
  '/:serviceId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('services.read'),
  validate(serviceIdValidator),
  serviceController.getServiceById.bind(serviceController)
);

/**
 * @swagger
 * /services:
 *   post:
 *     summary: Create new service
 *     tags: [Services]
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
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               duration:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Service created
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('services.create'),
  validate(createServiceValidator),
  serviceController.createService.bind(serviceController)
);

/**
 * @swagger
 * /services/{serviceId}:
 *   put:
 *     summary: Update service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
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
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               duration:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Service updated
 *       404:
 *         description: Service not found
 */
router.put(
  '/:serviceId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('services.update'),
  validate([...serviceIdValidator, ...updateServiceValidator]),
  serviceController.updateService.bind(serviceController)
);

/**
 * @swagger
 * /services/{serviceId}:
 *   delete:
 *     summary: Delete service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Service deleted
 *       404:
 *         description: Service not found
 */
router.delete(
  '/:serviceId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('services.delete'),
  validate(serviceIdValidator),
  serviceController.deleteService.bind(serviceController)
);

/**
 * @swagger
 * /services/{serviceId}/activate:
 *   patch:
 *     summary: Activate service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Service activated
 */
router.patch(
  '/:serviceId/activate',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('services.update'),
  validate(serviceIdValidator),
  serviceController.activateService.bind(serviceController)
);

/**
 * @swagger
 * /services/{serviceId}/deactivate:
 *   patch:
 *     summary: Deactivate service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Service deactivated
 */
router.patch(
  '/:serviceId/deactivate',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('services.update'),
  validate(serviceIdValidator),
  serviceController.deactivateService.bind(serviceController)
);

/**
 * @swagger
 * /services/{serviceId}/toggle:
 *   patch:
 *     summary: Toggle service active status
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Service status toggled successfully
 */
router.patch(
  '/:serviceId/toggle',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('services.update'),
  validate(serviceIdValidator),
  serviceController.toggleServiceStatus.bind(serviceController)
);

export default router;