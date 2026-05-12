import { body, param, query, type ValidationChain } from 'express-validator';

export const payPlanIdValidator: ValidationChain[] = [
  param('payPlanId')
    .notEmpty()
    .withMessage('Payment plan ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid payment plan ID format'),
];

export const patientIdParamValidator: ValidationChain[] = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
];

export const payPlanSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('patientId').optional().isInt({ min: 1 }).withMessage('Invalid patient ID format'),
];

export const createPayPlanValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('totalAmount')
    .notEmpty()
    .withMessage('Total amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Total amount must be greater than 0'),
  body('downPayment')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Down payment must be a non-negative number'),
  body('monthlyPayment')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Monthly payment must be a non-negative number'),
  body('numberOfPayments')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Number of payments must be a positive integer'),
  body('apr')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('APR must be a non-negative number'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];

export const updatePayPlanValidator: ValidationChain[] = [
  body('isClosed').optional().isBoolean().withMessage('isClosed must be a boolean'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];
