import { body, param, query, ValidationChain } from 'express-validator';

export const updateUserValidator: ValidationChain[] = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('preferredLanguage')
    .optional()
    .isIn(['en', 'es', 'fr', 'de'])
    .withMessage('Preferred language must be one of: en, es, fr, de'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const userIdValidator: ValidationChain[] = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid user ID format'),
];

export const assignRoleValidator: ValidationChain[] = [
  body('roleId')
    .notEmpty()
    .withMessage('Role ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid role ID format'),
];

export const createUserValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('preferredLanguage')
    .optional()
    .isIn(['en', 'es', 'fr', 'de'])
    .withMessage('Preferred language must be one of: en, es, fr, de'),
  body('roleId')
    .optional()
    .isString()
    .withMessage('Role ID must be a string')
    .trim()
    .notEmpty()
    .withMessage('Role ID cannot be empty'),
  body('roleIds')
    .optional()
    .isArray()
    .withMessage('roleIds must be an array'),
  body('roleIds.*')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each roleId must be a non-empty string'),
];

export const queryValidator: ValidationChain[] = [
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
  query('roleId')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('roleId must be a non-empty string'),
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('status must be active or inactive'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date string'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date string'),
];

export const assignUserRolesValidator: ValidationChain[] = [
  ...userIdValidator,
  body('roleIds')
    .isArray()
    .withMessage('roleIds must be an array of strings'),
  body('roleIds.*')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each role ID must be a non-empty string'),
];
