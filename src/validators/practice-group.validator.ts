import { body, param } from 'express-validator';

export const createPracticeGroupValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('name is required')
    .isLength({ max: 255 })
    .withMessage('name must be at most 255 characters'),
];

export const groupIdParamValidator = [
  param('groupId').isInt({ min: 1 }).withMessage('Invalid practice group id'),
];

export const createBranchValidator = [
  ...groupIdParamValidator,
  body('name').trim().notEmpty().withMessage('name is required'),
  body('address').optional().isString(),
  body('city').optional().isString(),
  body('state').optional().isString(),
  body('zip').optional().isString(),
  body('phone').optional().isString(),
];

export const createGroupAdminValidator = [
  ...groupIdParamValidator,
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('firstName').trim().notEmpty().withMessage('firstName is required'),
  body('lastName').trim().notEmpty().withMessage('lastName is required'),
  body('clinicId')
    .notEmpty()
    .withMessage('clinicId is required')
    .matches(/^\d+$/)
    .withMessage('clinicId must be a branch id from this practice group'),
];
