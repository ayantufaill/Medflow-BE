import { query } from 'express-validator';

export const branchAnalyticsValidator = [
  query('branchId')
    .optional()
    .isString()
    .withMessage('branchId must be a string'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
];
