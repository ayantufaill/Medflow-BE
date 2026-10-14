import { body, param, query } from 'express-validator';

export const getRxValidator = [
  query('patientId').optional().isString().withMessage('patientId must be a string'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 }),
];

export const createRxValidator = [
  body('patientId').notEmpty().withMessage('patientId is required'),
  body('medicationId').optional().isString().withMessage('medicationId must be a string'),
body('description').optional().isString().withMessage('description must be a string'),
body().custom((value) => {
  if (!value.medicationId && !value.description) {
    throw new Error('Either medicationId or description is required');
  }
  return true;
}),
  body('providerId').optional().isString(),
  body('startDate').optional().isISO8601(),
  body('duration').optional().isString(),
  body('longTerm').optional().isString(),
  body('refills').optional().isString(),
  body('dose').optional().isString(),
  body('notes').optional().isString(),
];

/** GET /rx/:id/print — a non-numeric id reached BigInt() and answered 500. */
export const rxIdValidator = [
  param('id').isInt({ min: 1 }).withMessage('Prescription id must be a positive integer'),
];
