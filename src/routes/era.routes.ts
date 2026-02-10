import { Router } from 'express';
import { eraController } from '../controllers/era.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { uploadERAFile } from '../middleware/upload.middleware';
import {
  eraIdValidator,
  eraItemIdValidator,
  eraListValidator,
  unmatchedItemsValidator,
} from '../validators/era.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission('invoices.read'),
  validate(eraListValidator),
  eraController.getAllERAs.bind(eraController)
);

router.get(
  '/unmatched',
  authenticate,
  requirePermission('invoices.read'),
  validate(unmatchedItemsValidator),
  eraController.getUnmatchedItems.bind(eraController)
);

router.get(
  '/:eraId/items',
  authenticate,
  requirePermission('invoices.read'),
  validate(eraIdValidator),
  eraController.getERAItems.bind(eraController)
);

router.get(
  '/:eraId',
  authenticate,
  requirePermission('invoices.read'),
  validate(eraIdValidator),
  eraController.getERAById.bind(eraController)
);

router.post(
  '/import',
  authenticate,
  requirePermission('invoices.update'),
  uploadERAFile.single('file'),
  eraController.importERAFile.bind(eraController)
);

router.post(
  '/:eraId/auto-post',
  authenticate,
  requirePermission('invoices.update'),
  validate(eraIdValidator),
  eraController.autoPostPayments.bind(eraController)
);

router.post(
  '/items/:eraItemId/match',
  authenticate,
  requirePermission('invoices.update'),
  validate(eraItemIdValidator),
  eraController.matchERAItem.bind(eraController)
);

export default router;
