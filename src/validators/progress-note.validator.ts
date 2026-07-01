import { body, query, param } from 'express-validator';

export const getProgressNotesValidator = [
  query('patientId').optional().isString().withMessage('patientId must be a string'),
  query('tab').optional().isString(),
  query('category').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 }),
];

export const createProgressNoteValidator = [
  body('patientId').notEmpty().withMessage('patientId is required'),
  body('category').notEmpty().withMessage('category is required'),
  body('description').notEmpty().withMessage('description is required'),
  body('providerId').notEmpty().withMessage('providerId is required'),
];

export const addProcedureValidator = [
  param('id').notEmpty().withMessage('Note ID is required'),
  body('procedureCode').notEmpty().withMessage('procedureCode is required'),
];
