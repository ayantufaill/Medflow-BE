import { Router } from 'express';
import { providerController } from '../controllers/provider.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  providerIdValidator,
  createProviderValidator,
  updateProviderValidator,
  providerQueryValidator,
} from '../validators/provider.validator';

const router = Router();

// All provider routes require authentication
router.use(authenticate);

// Get all providers
router.get(
  '/',
  validate(providerQueryValidator),
  providerController.getAllProviders.bind(providerController)
);

router.get('/specialties', providerController.getSpecialties.bind(providerController));

// Get provider by ID
router.get(
  '/:providerId',
  validate(providerIdValidator),
  providerController.getProviderById.bind(providerController)
);

// Create provider (Admin only)
router.post(
  '/',
  requireRoles('Admin'),
  validate(createProviderValidator),
  providerController.createProvider.bind(providerController)
);

// Update provider (Admin only)
router.put(
  '/:providerId',
  requireRoles('Admin'),
  validate([...providerIdValidator, ...updateProviderValidator]),
  providerController.updateProvider.bind(providerController)
);

// Activate provider (Admin only)
router.patch(
  '/:providerId/activate',
  requireRoles('Admin'),
  validate(providerIdValidator),
  providerController.activateProvider.bind(providerController)
);

// Deactivate provider (Admin only)
router.patch(
  '/:providerId/deactivate',
  requireRoles('Admin'),
  validate(providerIdValidator),
  providerController.deactivateProvider.bind(providerController)
);

// Delete provider permanently (Admin only)
router.delete(
  '/:providerId',
  requireRoles('Admin'),
  validate(providerIdValidator),
  providerController.deleteProvider.bind(providerController)
);

export default router;
