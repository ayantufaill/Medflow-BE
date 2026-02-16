import { body, param, query, type ValidationChain } from 'express-validator';

const claimStatusValues = [
  'draft',
  'submitted',
  'pending',
  'paid',
  'partial',
  'partially_paid',
  'accepted',
  'denied',
  'rejected',
  'cancelled',
];

export const claimIdValidator: ValidationChain[] = [
  param('claimId').isString().notEmpty().withMessage('claimId is required'),
];

export const invoiceIdParamValidator: ValidationChain[] = [
  param('invoiceId').isString().notEmpty().withMessage('invoiceId is required'),
];

export const claimDocumentIdValidator: ValidationChain[] = [
  param('documentId').isString().notEmpty().withMessage('documentId is required'),
];

export const claimSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
  query('search').optional().isString().withMessage('search must be a string'),
  query('status').optional().isIn(claimStatusValues).withMessage('Invalid status value'),
  query('patientId').optional().isString().withMessage('patientId must be a string'),
  query('invoiceId').optional().isString().withMessage('invoiceId must be a string'),
  query('insuranceCompanyId').optional().isString().withMessage('insuranceCompanyId must be a string'),
  query('insuranceType').optional().isString().withMessage('insuranceType must be a string'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
  query('deniedOnly').optional().isBoolean().withMessage('deniedOnly must be true or false'),
];

export const createClaimFromInvoiceValidator: ValidationChain[] = [
  body('insuranceCompanyId').optional().isString().withMessage('insuranceCompanyId must be a string'),
  body('insuranceType').optional().isString().withMessage('insuranceType must be a string'),
  body('claimAmount').optional().isFloat({ min: 0 }).withMessage('claimAmount must be >= 0'),
  body('submittedAmount').optional().isFloat({ min: 0 }).withMessage('submittedAmount must be >= 0'),
  body('policyNumber').optional().isString().withMessage('policyNumber must be a string'),
  body('notes').optional().isString().isLength({ max: 2000 }).withMessage('notes must be less than 2000 characters'),
];

export const updateClaimValidator: ValidationChain[] = [
  body('insuranceCompanyId').optional().isString().withMessage('insuranceCompanyId must be a string'),
  body('invoiceId').optional().isString().withMessage('invoiceId must be a string'),
  body('insuranceType').optional().isString().withMessage('insuranceType must be a string'),
  body('status').optional().isIn(claimStatusValues).withMessage('Invalid status value'),
  body('claimAmount').optional().isFloat({ min: 0 }).withMessage('claimAmount must be >= 0'),
  body('submittedAmount').optional().isFloat({ min: 0 }).withMessage('submittedAmount must be >= 0'),
  body('totalAmount').optional().isFloat({ min: 0 }).withMessage('totalAmount must be >= 0'),
  body('paidAmount').optional().isFloat({ min: 0 }).withMessage('paidAmount must be >= 0'),
  body('patientResponsibility').optional().isFloat({ min: 0 }).withMessage('patientResponsibility must be >= 0'),
  body('policyNumber').optional().isString().withMessage('policyNumber must be a string'),
  body('notes').optional().isString().isLength({ max: 2000 }).withMessage('notes must be less than 2000 characters'),
  body('submissionDate').optional().isISO8601().withMessage('submissionDate must be a valid date'),
  body('deniedDate').optional({ nullable: true }).isISO8601().withMessage('deniedDate must be a valid date'),
  body('denialReason').optional({ nullable: true }).isString().withMessage('denialReason must be a string'),
  body('paidDate').optional().isISO8601().withMessage('paidDate must be a valid date'),
];

export const resubmitClaimValidator: ValidationChain[] = [
  body('workflowType').optional().isIn(['correction', 'appeal']).withMessage('Invalid workflow type'),
  body('correctionNotes').optional().isString().withMessage('correctionNotes must be a string'),
  body('appealReason').optional().isString().withMessage('appealReason must be a string'),
  body('correctedFields').optional().isObject().withMessage('correctedFields must be an object'),
];
