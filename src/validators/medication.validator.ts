import { query, param, body } from 'express-validator';

export const medicationSearchValidator = [
  query('search')
    .optional()
    .isString()
    .trim()
    .withMessage('Search query must be a string'),
];

export const medicationIdValidator = [
  param('id')
    .exists()
    .withMessage('Medication ID or name parameter is required')
    .trim()
    .notEmpty()
    .withMessage('Medication ID or name cannot be empty'),
];

export const createMedicationValidator = [
  body('name')
    .exists()
    .withMessage('Medication name is required')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Medication name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Medication name cannot exceed 255 characters'),
  body('genericName')
    .optional({ nullable: true })
    .isString()
    .trim(),
  body('notes')
    .optional({ nullable: true })
    .isString()
    .trim(),
  body('rxCui')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === undefined || val === '') return true;
      const parsed = Number(val);
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error('rxCui must be a positive number');
      }
      return true;
    }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const updateMedicationValidator = [
  param('id')
    .exists()
    .withMessage('Medication ID or name parameter is required')
    .trim()
    .notEmpty()
    .withMessage('Medication ID or name cannot be empty'),
  body('name')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Medication name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Medication name cannot exceed 255 characters'),
  body('genericName')
    .optional({ nullable: true })
    .isString()
    .trim(),
  body('notes')
    .optional({ nullable: true })
    .isString()
    .trim(),
  body('rxCui')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === undefined || val === '') return true;
      const parsed = Number(val);
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error('rxCui must be a positive number');
      }
      return true;
    }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];
