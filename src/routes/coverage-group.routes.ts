import { Router } from 'express';
import { coverageGroupController } from '../controllers/coverage-group.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createCoverageGroupValidator } from '../validators/coverage-group.validator';

const router = Router();

router.use(authenticate);

router.get('/', coverageGroupController.getCoverageGroups.bind(coverageGroupController));
router.post(
  '/',
  validate(createCoverageGroupValidator),
  coverageGroupController.createCoverageGroup.bind(coverageGroupController)
);
router.delete('/:groupId', coverageGroupController.deleteCoverageGroup.bind(coverageGroupController));

export default router;
