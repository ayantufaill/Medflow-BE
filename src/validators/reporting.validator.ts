import { body, param, type ValidationChain } from 'express-validator';

export const saveReportValidator: ValidationChain[] = [
  body('name').isString().notEmpty().withMessage('Report name is required'),
  body('kind').isIn(['Patient', 'Procedures']).withMessage('Invalid report kind'),
  body('filters').optional().isArray().withMessage('Filters must be an array'),
  body('columns').isArray({ min: 1 }).withMessage('Columns must be a non-empty array of strings'),
  body('columns.*').isString().notEmpty().withMessage('Each column name must be a string'),
];

export const runReportValidator: ValidationChain[] = [
  body('kind').isIn(['Patient', 'Procedures']).withMessage('Invalid report kind'),
  body('filters').optional().isArray().withMessage('Filters must be an array'),
  body('columns').isArray({ min: 1 }).withMessage('Columns must be a non-empty array of strings'),
  body('columns.*').isString().notEmpty().withMessage('Each column name must be a string'),
  body('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  body('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
];

export const reportIdParamValidator: ValidationChain[] = [
  param('reportId').isString().notEmpty().withMessage('reportId is required'),
];
