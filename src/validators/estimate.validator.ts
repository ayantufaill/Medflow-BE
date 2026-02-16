import { body, param, query, type ValidationChain } from 'express-validator';

export const estimateIdValidator: ValidationChain[] = [
  param('estimateId')
    .notEmpty()
    .withMessage('Estimate ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid estimate ID format'),
];

export const estimateSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('search').optional().isString().withMessage('search must be a string'),
  query('patientId')
    .optional()
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid patient ID format'),
  query('status')
    .optional()
    .isIn(['draft', 'sent', 'approved', 'declined', 'converted', 'expired'])
    .withMessage('Invalid status value'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

export const createEstimateValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid patient ID format'),
  body('providerId')
    .optional()
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid provider ID format'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('estimatedAmount')
    .notEmpty()
    .withMessage('Estimated amount is required')
    .isFloat({ min: 0 })
    .withMessage('Estimated amount must be a positive number'),
  body('insurancePortion')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Insurance portion must be a positive number'),
  body('patientPortion')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Patient portion must be a positive number'),
  body('status')
    .optional()
    .isIn(['draft', 'sent', 'approved', 'declined', 'converted', 'expired'])
    .withMessage('Invalid status value'),
  body('createdDate').optional().isISO8601().withMessage('createdDate must be a valid date'),
  body('expirationDate')
    .optional()
    .isISO8601()
    .withMessage('expirationDate must be a valid date'),
];

export const updateEstimateValidator: ValidationChain[] = [
  body('providerId')
    .optional()
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid provider ID format'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('estimatedAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated amount must be a positive number'),
  body('insurancePortion')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Insurance portion must be a positive number'),
  body('patientPortion')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Patient portion must be a positive number'),
  body('status')
    .optional()
    .isIn(['draft', 'sent', 'approved', 'declined', 'converted', 'expired'])
    .withMessage('Invalid status value'),
  body('expirationDate')
    .optional()
    .isISO8601()
    .withMessage('expirationDate must be a valid date'),
  body('approvedDate').optional().isISO8601().withMessage('approvedDate must be a valid date'),
];

export const convertEstimateValidator: ValidationChain[] = [
  body('appointmentId')
    .notEmpty()
    .withMessage('Appointment ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid appointment ID format'),
  body('dueDate')
    .notEmpty()
    .withMessage('Due date is required')
    .isISO8601()
    .withMessage('Due date must be a valid date'),
];

export const declineEstimateValidator: ValidationChain[] = [
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('reason must be less than 500 characters'),
];
