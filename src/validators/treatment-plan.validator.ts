import { param, body, query } from 'express-validator';

export const getTreatmentPlansValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('patientId').optional().isString().withMessage('Patient ID must be a string'),
];

export const treatmentPlanIdValidator = [
  param('id').notEmpty().withMessage('Treatment plan ID is required'),
];

export const createTreatmentPlanValidator = [
  body('patientId').notEmpty().withMessage('Patient ID is required.'),
  body('title').notEmpty().withMessage('Title is required.'),
  body('status').optional().isString(),
  body('totalAmount').optional().isFloat(),
  body('items').optional().isArray(),
];

export const updateTreatmentPlanValidator = [
  body('title').optional().isString(),
  body('notes').optional().isString(),
  body('status').optional().isString(),
  body('totalAmount').optional().isFloat(),
  body('items').optional().isArray(),
];
