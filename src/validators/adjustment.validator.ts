import { body, param, query, type ValidationChain } from 'express-validator';

export const adjustmentIdValidator: ValidationChain[] = [
  param('adjustmentId')
    .notEmpty()
    .withMessage('Adjustment ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid adjustment ID format'),
];

export const patientIdParamValidator: ValidationChain[] = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
];

export const adjustmentSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('patientId').optional().isInt({ min: 1 }).withMessage('Invalid patient ID format'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

export const createAdjustmentValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat()
    .withMessage('Amount must be a number'),
  body('date')
    .notEmpty()
    .withMessage('Adjustment date is required')
    .isISO8601()
    .withMessage('Adjustment date must be a valid date'),
  body('providerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
  body('type')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid type format (DefNum)'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];

export const updateAdjustmentValidator: ValidationChain[] = [
  body('amount').optional().isFloat().withMessage('Amount must be a number'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('type').optional().isInt({ min: 1 }).withMessage('Invalid type format'),
  body('providerId').optional().isInt({ min: 1 }).withMessage('Invalid provider ID format'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];
