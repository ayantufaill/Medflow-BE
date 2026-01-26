import { Router } from 'express';
import { practiceInfoController } from '../controllers/practice-info.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { validateFormData } from '../middleware/formDataValidation.middleware';
import { uploadLogo } from '../middleware/upload.middleware';
import {
  createPracticeInfoValidator,
  updatePracticeInfoValidator,
  practiceInfoIdValidator,
  queryValidator,
} from '../validators/practice-info.validator';

const router = Router();

// All practice info routes require authentication
router.use(authenticate);

// Get all practice info records (Admin only)
router.get(
  '/',
  requireRoles('Admin'),
  validate(queryValidator),
  practiceInfoController.getAllPracticeInfo.bind(practiceInfoController)
);

// Get single practice info (most recent) (Admin only)
router.get(
  '/current',
  requireRoles('Admin'),
  practiceInfoController.getPracticeInfo.bind(practiceInfoController)
);

// Get practice info by ID (Admin only)
router.get(
  '/:practiceInfoId',
  requireRoles('Admin'),
  validate(practiceInfoIdValidator),
  practiceInfoController.getPracticeInfoById.bind(practiceInfoController)
);

// Create practice info (Admin only)
// Note: multer must come before validation to parse FormData
router.post(
  '/',
  requireRoles('Admin'),
  uploadLogo.single('logo'),
  validateFormData(createPracticeInfoValidator),
  practiceInfoController.createPracticeInfo.bind(practiceInfoController)
);

// Update practice info (Admin only)
// Note: multer must come before validation to parse FormData
router.put(
  '/:practiceInfoId',
  requireRoles('Admin'),
  uploadLogo.single('logo'),
  validateFormData([...practiceInfoIdValidator, ...updatePracticeInfoValidator]),
  practiceInfoController.updatePracticeInfo.bind(practiceInfoController)
);

// Delete practice info (Admin only)
router.delete(
  '/:practiceInfoId',
  requireRoles('Admin'),
  validate(practiceInfoIdValidator),
  practiceInfoController.deletePracticeInfo.bind(practiceInfoController)
);

export default router;

