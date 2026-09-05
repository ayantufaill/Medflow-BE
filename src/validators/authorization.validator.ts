import { body, param, query, type ValidationChain } from 'express-validator';

const statusValues = ['requested', 'pending', 'approved', 'denied', 'expired', 'cancelled'];

export const authorizationIdValidator: ValidationChain[] = [
  param('authorizationId').isString().notEmpty().withMessage('Authorization ID is required'),
];

export const authorizationSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
  query('search').optional().isString().withMessage('search must be a string'),
  query('status').optional().isIn(statusValues).withMessage('Invalid status value'),
  query('patientId').optional().isString().withMessage('patientId must be a string'),
  query('insuranceCompanyId').optional().isString().withMessage('insuranceCompanyId must be a string'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

export const createAuthorizationValidator: ValidationChain[] = [
  body('patientId').notEmpty().withMessage('patientId is required'),
  body('insuranceCompanyId').optional(),
  body('serviceId').optional(),
  body('authorizationNumber').optional().isString().withMessage('authorizationNumber must be a string'),
  body('requestedDate').optional().isISO8601().withMessage('requestedDate must be a valid date'),
  body('approvedDate').optional().isISO8601().withMessage('approvedDate must be a valid date'),
  body('expirationDate').optional().isISO8601().withMessage('expirationDate must be a valid date'),
  body('status').optional().isIn(statusValues).withMessage('Invalid status value'),
  body('unitsAuthorized').optional().isInt({ min: 0 }).withMessage('unitsAuthorized must be >= 0'),
  body('unitsUsed').optional().isInt({ min: 0 }).withMessage('unitsUsed must be >= 0'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('notes must be less than 1000 characters'),
  body('requestedBy').optional().isString().withMessage('requestedBy must be a string'),
  body('tags').optional().isArray().withMessage('tags must be an array'),
  body('tags.*').optional(),
  body('procedures').optional().isArray().withMessage('procedures must be an array'),
  body('procedureIds').optional().isArray().withMessage('procedureIds must be an array'),
  body('order').optional().isString().withMessage('order must be a string'),
];

export const updateAuthorizationValidator: ValidationChain[] = [
  body('approvedDate').optional().isISO8601().withMessage('approvedDate must be a valid date'),
  body('expirationDate').optional().isISO8601().withMessage('expirationDate must be a valid date'),
  body('status').optional().isIn(statusValues).withMessage('Invalid status value'),
  body('unitsAuthorized').optional().isInt({ min: 0 }).withMessage('unitsAuthorized must be >= 0'),
  body('unitsUsed').optional().isInt({ min: 0 }).withMessage('unitsUsed must be >= 0'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('notes must be less than 1000 characters'),
  body('insuranceCompanyId').optional(),
  body('serviceId').optional(),
  body('tags').optional().isArray().withMessage('tags must be an array'),
  body('tags.*').optional(),
  body('procedures').optional().isArray().withMessage('procedures must be an array'),
  body('procedureIds').optional().isArray().withMessage('procedureIds must be an array'),
  body('order').optional().isString().withMessage('order must be a string'),
];
