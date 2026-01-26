import { Router } from 'express';
import { serviceController } from '../controllers/service.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  serviceIdValidator,
  serviceSearchValidator,
  createServiceValidator,
  updateServiceValidator,
} from '../validators/service.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('services.read'),
  validate(serviceSearchValidator),
  serviceController.getAllServices.bind(serviceController)
);

router.get(
  '/:serviceId',
  authenticate,
  requirePermission('services.read'),
  validate(serviceIdValidator),
  serviceController.getServiceById.bind(serviceController)
);

router.post(
  '/',
  authenticate,
  requirePermission('services.create'),
  validate(createServiceValidator),
  serviceController.createService.bind(serviceController)
);

router.put(
  '/:serviceId',
  authenticate,
  requirePermission('services.update'),
  validate([...serviceIdValidator, ...updateServiceValidator]),
  serviceController.updateService.bind(serviceController)
);

router.delete(
  '/:serviceId',
  authenticate,
  requirePermission('services.delete'),
  validate(serviceIdValidator),
  serviceController.deleteService.bind(serviceController)
);

export default router;
