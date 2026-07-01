import { body, param, query, type ValidationChain } from 'express-validator';

const eraStatuses = ['imported', 'processing', 'processed', 'error', 'partial'];

export const eraIdValidator: ValidationChain[] = [
  param('eraId').isString().notEmpty().withMessage('eraId is required'),
];

export const eraItemIdValidator: ValidationChain[] = [
  param('eraItemId').isString().notEmpty().withMessage('eraItemId is required'),
];

export const eraSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
  query('search').optional().isString().withMessage('search must be a string'),
  query('status').optional().isIn(eraStatuses).withMessage('Invalid status value'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

export const unmatchedSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
  query('search').optional().isString().withMessage('search must be a string'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

export const matchEraItemValidator: ValidationChain[] = [
  body('claimId').optional({ nullable: true }).isString().withMessage('claimId must be a string'),
  body('invoiceId').optional({ nullable: true }).isString().withMessage('invoiceId must be a string'),
];
