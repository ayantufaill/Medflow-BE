import { param, query, type ValidationChain } from 'express-validator';

export const eraIdValidator: ValidationChain[] = [
  param('eraId').notEmpty().withMessage('ERA ID is required'),
];

export const eraItemIdValidator: ValidationChain[] = [
  param('eraItemId').notEmpty().withMessage('ERA item ID is required'),
];

export const eraListValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('status').optional().isIn(['imported', 'processing', 'processed', 'failed']).withMessage('Invalid status'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

export const unmatchedItemsValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];
