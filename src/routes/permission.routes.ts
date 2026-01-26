import { Router } from 'express';
import { roleController } from '../controllers/role.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();

// All permission routes require authentication
router.use(authenticate);

// Check permission
router.post(
  '/check',
  validate([
    body('permission')
      .trim()
      .notEmpty()
      .withMessage('Permission is required')
      .isString()
      .withMessage('Permission must be a string'),
    body('userId').optional().isString().trim().withMessage('User ID must be a string'),
  ]),
  roleController.checkPermission.bind(roleController)
);

export default router;

