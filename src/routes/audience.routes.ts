import { Router } from 'express';
import { audienceController } from '../controllers/audience.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('reports.read'),
  audienceController.getSavedAudiences.bind(audienceController)
);

router.post(
  '/',
  authenticate,
  requirePermission('reports.administrative'),
  audienceController.saveAudience.bind(audienceController)
);

router.delete(
  '/:audienceId',
  authenticate,
  requirePermission('reports.administrative'),
  audienceController.deleteAudience.bind(audienceController)
);

export default router;
