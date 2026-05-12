import { body, param, query, type ValidationChain } from 'express-validator';

export const depositIdValidator: ValidationChain[] = [
  param('depositId')
    .notEmpty()
    .withMessage('Deposit ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid deposit ID format'),
];

export const patientIdParamValidator: ValidationChain[] = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
];

export const depositSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('patientId').optional().isInt({ min: 1 }).withMessage('Invalid patient ID format'),
];

export const createDepositValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['cash', 'check', 'card', 'ach', 'insurance'])
    .withMessage('Invalid payment method'),
  body('depositType')
    .notEmpty()
    .withMessage('Deposit type is required')
    .isIn(['patient', 'insurance'])
    .withMessage('Invalid deposit type'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid date'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
];
