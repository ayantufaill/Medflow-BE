import { body, param, query, type ValidationChain } from 'express-validator';

export const saveReportValidator: ValidationChain[] = [
  body('name').isString().notEmpty().withMessage('Report name is required'),
  body('kind').isIn(['Patient', 'Procedures', 'Financial']).withMessage('Invalid report kind'),
  body('filters').optional().isArray().withMessage('Filters must be an array'),
  body('columns').isArray().withMessage('Columns must be an array of strings'),
  body('columns.*').isString().notEmpty().withMessage('Each column name must be a string'),
];

export const runReportValidator: ValidationChain[] = [
  body('kind').isIn(['Patient', 'Procedures', 'Financial']).withMessage('Invalid report kind'),
  body('filters').optional().isArray().withMessage('Filters must be an array'),
  body('columns').isArray().withMessage('Columns must be an array of strings'),
  body('columns.*').isString().notEmpty().withMessage('Each column name must be a string'),
  body('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  body('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
];

export const reportIdParamValidator: ValidationChain[] = [
  param('reportId').isString().notEmpty().withMessage('reportId is required'),
];

export const archiveReportValidator: ValidationChain[] = [
  body('type').isString().notEmpty().withMessage('Report type is required'),
  body('data').notEmpty().withMessage('Report data is required'),
];

export const financialReportQueryValidator: ValidationChain[] = [
  query('billingBeforeDate')
    .if(query('billingDate').equals('pt_last_statement_before'))
    .notEmpty()
    .withMessage('billingBeforeDate is required when billingDate is pt_last_statement_before')
    .isISO8601()
    .withMessage('billingBeforeDate must be a valid ISO8601 date'),
  query('billingDaysSince')
    .if(query('billingDate').equals('day_since_last_statement'))
    .notEmpty()
    .withMessage('billingDaysSince is required when billingDate is day_since_last_statement')
    .isInt({ min: 1, max: 3650 })
    .withMessage('billingDaysSince must be an integer between 1 and 3650'),
];

