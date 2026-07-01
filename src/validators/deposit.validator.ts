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

export const createDepositSlipValidator: ValidationChain[] = [
  body('bankAccountInfo')
    .optional()
    .trim()
    .isString()
    .withMessage('Bank account info must be a string'),
  body('memo')
    .optional()
    .trim()
    .isString()
    .withMessage('Memo must be a string'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid date'),
  body('patientPaymentIds')
    .optional()
    .isArray()
    .withMessage('Patient payment IDs must be an array'),
  body('patientPaymentIds.*')
    .isInt({ min: 1 })
    .withMessage('Invalid patient payment ID format'),
  body('insurancePaymentIds')
    .optional()
    .isArray()
    .withMessage('Insurance payment IDs must be an array'),
  body('insurancePaymentIds.*')
    .isInt({ min: 1 })
    .withMessage('Invalid insurance payment ID format'),
];

