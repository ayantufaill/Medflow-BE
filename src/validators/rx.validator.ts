import { body, query } from 'express-validator';

export const getRxValidator = [
  query('patientId').optional().isString().withMessage('patientId must be a string'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 }),
];

export const createRxValidator = [
  body('patientId').notEmpty().withMessage('patientId is required'),
  body('description').notEmpty().withMessage('description is required'),
  body('providerId').optional().isString(),
  body('startDate').optional().isISO8601(),
  body('duration').optional().isString(),
  body('longTerm').optional().isString(),
  body('refills').optional().isString(),
  body('dose').optional().isString(),
  body('notes').optional().isString(),
];
