import { Router } from 'express';
import { eraController } from '../controllers/era.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { uploadEraFile } from '../middleware/upload.middleware';
import {
  eraIdValidator,
  eraItemIdValidator,
  eraSearchValidator,
  unmatchedSearchValidator,
  matchEraItemValidator,
} from '../validators/era.validator';

const router = Router();

router.post(
  '/import',
  authenticate,
  requirePermission('era.create'),
  uploadEraFile.any(),
  eraController.importERAFile.bind(eraController)
);

router.get(
  '/',
  authenticate,
  requirePermission('era.read'),
  validate(eraSearchValidator),
  eraController.getAllERAs.bind(eraController)
);

router.get(
  '/unmatched',
  authenticate,
  requirePermission('era.read'),
  validate(unmatchedSearchValidator),
  eraController.getUnmatchedItems.bind(eraController)
);

router.post(
  '/items/:eraItemId/match',
  authenticate,
  requirePermission('era.update'),
  validate([...eraItemIdValidator, ...matchEraItemValidator]),
  eraController.matchERAItem.bind(eraController)
);

router.get(
  '/:eraId',
  authenticate,
  requirePermission('era.read'),
  validate(eraIdValidator),
  eraController.getERAById.bind(eraController)
);

router.get(
  '/:eraId/items',
  authenticate,
  requirePermission('era.read'),
  validate(eraIdValidator),
  eraController.getERAItems.bind(eraController)
);

router.post(
  '/:eraId/auto-post',
  authenticate,
  requirePermission('era.update'),
  validate(eraIdValidator),
  eraController.autoPostPayments.bind(eraController)
);

export default router;
