import { param, query, body, type ValidationChain } from 'express-validator';

export const authorizationIdValidator: ValidationChain[] = [
  param('authorizationId').notEmpty().withMessage('Authorization ID is required'),
];

export const authorizationListValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('patientId').optional().notEmpty().withMessage('Patient ID cannot be empty'),
  query('insuranceCompanyId').optional().notEmpty().withMessage('Insurance company ID cannot be empty'),
  query('status').optional().isIn(['pending', 'approved', 'denied', 'expired']).withMessage('Invalid status'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

export const createAuthorizationValidator: ValidationChain[] = [
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('insuranceCompanyId').notEmpty().withMessage('Insurance company ID is required'),
  body('serviceId').notEmpty().withMessage('Service ID is required'),
  body('authorizationNumber').optional().trim(),
  body('requestedDate').optional().isISO8601().withMessage('requestedDate must be a valid date'),
  body('expirationDate').optional().isISO8601().withMessage('expirationDate must be a valid date'),
  body('unitsAuthorized').optional().isInt({ min: 0 }).withMessage('unitsAuthorized must be non-negative'),
  body('notes').optional().trim(),
];

export const updateAuthorizationValidator: ValidationChain[] = [
  body('status').optional().isIn(['pending', 'approved', 'denied', 'expired']).withMessage('Invalid status'),
  body('approvedDate').optional().isISO8601().withMessage('approvedDate must be a valid date'),
  body('expirationDate').optional().isISO8601().withMessage('expirationDate must be a valid date'),
  body('unitsAuthorized').optional().isInt({ min: 0 }).withMessage('unitsAuthorized must be non-negative'),
  body('unitsUsed').optional().isInt({ min: 0 }).withMessage('unitsUsed must be non-negative'),
  body('notes').optional().trim(),
];
