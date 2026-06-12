import { query, param } from 'express-validator';

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
