import { body, param, query, ValidationChain } from 'express-validator';

export const noteTemplateIdValidator: ValidationChain[] = [
  param('noteTemplateId')
    .notEmpty()
    .withMessage('Note template ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid note template ID format'),
];

export const createNoteTemplateValidator: ValidationChain[] = [
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
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('templateStructure')
    .notEmpty()
    .withMessage('Template structure is required')
    .custom((value) => {
      if (typeof value !== 'object' || value === null) {
        throw new Error('Template structure must be a valid object');
      }
      return true;
    }),
  body('defaultContent')
    .optional()
    .custom((value) => {
      if (value !== undefined && (typeof value !== 'object' || value === null)) {
        throw new Error('Default content must be a valid object');
      }
      return true;
    }),
  body('specialty')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Specialty must be less than 100 characters'),
];

export const updateNoteTemplateValidator: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .custom((value) => {
      if (value !== undefined && (!value || value.length === 0)) {
        throw new Error('Name cannot be empty');
      }
      return true;
    })
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('templateStructure')
    .optional()
    .custom((value) => {
      if (value !== undefined && (typeof value !== 'object' || value === null)) {
        throw new Error('Template structure must be a valid object');
      }
      return true;
    }),
  body('defaultContent')
    .optional()
    .custom((value) => {
      if (value !== undefined && (typeof value !== 'object' || value === null)) {
        throw new Error('Default content must be a valid object');
      }
      return true;
    }),
  body('specialty')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Specialty must be less than 100 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const duplicateNoteTemplateValidator: ValidationChain[] = [
  body('newName')
    .notEmpty()
    .withMessage('New name is required')
    .trim()
    .custom((value) => {
      if (!value || value.length === 0) {
        throw new Error('New name cannot be empty');
      }
      return true;
    })
    .isLength({ min: 1, max: 200 })
    .withMessage('New name must be between 1 and 200 characters'),
];

export const noteTemplateQueryValidator: ValidationChain[] = [
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
  query('specialty')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Specialty must be between 1 and 100 characters'),
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be either true or false'),
];

export const specialtyParamValidator: ValidationChain[] = [
  param('specialty')
    .notEmpty()
    .withMessage('Specialty is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Specialty must be between 1 and 100 characters'),
];
