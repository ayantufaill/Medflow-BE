import { body, param, query, ValidationChain } from 'express-validator';

export const appointmentTypeIdValidator: ValidationChain[] = [
  param('appointmentTypeId')
    .notEmpty()
    .withMessage('Appointment type ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid appointment type ID format'),
];

export const createAppointmentTypeValidator: ValidationChain[] = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim()
    .custom((value) => {
      if (!value || value.length === 0) {
        throw new Error('Name cannot be empty');
      }
      return true;
    })
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('defaultDuration')
    .notEmpty()
    .withMessage('Default duration is required')
    .isInt({ min: 1 })
    .withMessage('Default duration must be a positive integer greater than 0'),
  body('defaultPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Default price must be a non-negative number'),
  body('colorCode')
    .optional()
    .trim()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color code must be a valid hex color (e.g., #FF5733)'),
  body('requiresAuthorization')
    .optional()
    .isBoolean()
    .withMessage('requiresAuthorization must be a boolean'),
  body('bufferBefore')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Buffer before must be a non-negative integer'),
  body('bufferAfter')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Buffer after must be a non-negative integer'),
  body('isActive')
    .notEmpty()
    .withMessage('isActive is required')
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const updateAppointmentTypeValidator: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .custom((value) => {
      if (value !== undefined && (!value || value.length === 0)) {
        throw new Error('Name cannot be empty');
      }
      return true;
    })
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('defaultDuration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Default duration must be a positive integer greater than 0'),
  body('defaultPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Default price must be a non-negative number'),
  body('colorCode')
    .optional()
    .trim()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color code must be a valid hex color (e.g., #FF5733)'),
  body('requiresAuthorization')
    .optional()
    .isBoolean()
    .withMessage('requiresAuthorization must be a boolean'),
  body('bufferBefore')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Buffer before must be a non-negative integer'),
  body('bufferAfter')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Buffer after must be a non-negative integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const appointmentTypeQueryValidator: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be either true or false'),
];
