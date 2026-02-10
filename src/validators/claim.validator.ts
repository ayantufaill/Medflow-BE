import { param, query, body, type ValidationChain } from 'express-validator';

export const claimIdValidator: ValidationChain[] = [
  param('claimId').notEmpty().withMessage('Claim ID is required'),
];

export const invoiceIdValidator: ValidationChain[] = [
  param('invoiceId').notEmpty().withMessage('Invoice ID is required'),
];

export const claimListValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('patientId').optional().notEmpty().withMessage('Patient ID cannot be empty'),
  query('invoiceId').optional().notEmpty().withMessage('Invoice ID cannot be empty'),
  query('insuranceCompanyId').optional().notEmpty().withMessage('Insurance company ID cannot be empty'),
  query('status').optional().isIn(['draft', 'submitted', 'accepted', 'denied', 'partially_paid', 'paid']).withMessage('Invalid status'),
  query('deniedOnly').optional().isIn(['true', 'false']).withMessage('deniedOnly must be true or false'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

export const updateClaimValidator: ValidationChain[] = [
  body('status').optional().isIn(['draft', 'submitted', 'accepted', 'denied', 'partially_paid', 'paid']).withMessage('Invalid status'),
  body('paidAmount').optional().isFloat({ min: 0 }).withMessage('paidAmount must be positive'),
  body('patientResponsibility').optional().isFloat({ min: 0 }).withMessage('patientResponsibility must be positive'),
  body('payerType').optional().isIn(['primary', 'secondary', 'tertiary']).withMessage('Invalid payer type'),
  body('denialReason').optional().trim(),
  body('denialCode').optional().trim(),
];

export const createClaimFromInvoiceValidator: ValidationChain[] = [
  body('insuranceCompanyId').optional().notEmpty().withMessage('insuranceCompanyId cannot be empty'),
  body('payerType').optional().isIn(['primary', 'secondary', 'tertiary']).withMessage('Invalid payer type'),
];
