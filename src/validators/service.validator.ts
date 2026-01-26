import { body, param, query, type ValidationChain } from 'express-validator';

export const serviceIdValidator: ValidationChain[] = [
  param('serviceId')
    .notEmpty()
    .withMessage('Service ID is required')
    .isString()
    .withMessage('Service ID must be a string')
    .isLength({ min: 1 })
    .withMessage('Invalid service ID format'),
];

export const serviceSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('category').optional().isString().withMessage('Category must be a string'),
  query('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  query('isBillable').optional().isBoolean().withMessage('isBillable must be boolean'),
];

export const createServiceValidator: ValidationChain[] = [
  body('cptCode')
    .trim()
    .notEmpty()
    .withMessage('CPT code is required')
    .isLength({ min: 4, max: 10 })
    .withMessage('CPT code must be between 4 and 10 characters'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Service name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Service name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('defaultPrice')
    .notEmpty()
    .withMessage('Default price is required')
    .isFloat({ min: 0 })
    .withMessage('Default price must be a positive number'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 5, max: 480 })
    .withMessage('Duration must be between 5 and 480 minutes'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must be less than 100 characters'),
  body('requiresAuthorization')
    .optional()
    .isBoolean()
    .withMessage('requiresAuthorization must be a boolean'),
  body('isBillable').optional().isBoolean().withMessage('isBillable must be a boolean'),
  body('taxRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax rate must be a positive number'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

export const updateServiceValidator: ValidationChain[] = [
  body('cptCode')
    .optional()
    .trim()
    .isLength({ min: 4, max: 10 })
    .withMessage('CPT code must be between 4 and 10 characters'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Service name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('defaultPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Default price must be a positive number'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 5, max: 480 })
    .withMessage('Duration must be between 5 and 480 minutes'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must be less than 100 characters'),
  body('requiresAuthorization')
    .optional()
    .isBoolean()
    .withMessage('requiresAuthorization must be a boolean'),
  body('isBillable').optional().isBoolean().withMessage('isBillable must be a boolean'),
  body('taxRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax rate must be a positive number'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];
