import { body, param, query, type ValidationChain } from 'express-validator';

export const insurancePlanQueryValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('search must be a string'),
];

export const insurancePlanIdValidator: ValidationChain[] = [
  param('planId').notEmpty().withMessage('planId is required').isInt({ min: 1 }).withMessage('Invalid plan ID format'),
];

export const insurancePlanPayloadValidator: ValidationChain[] = [
  body('insuranceCompanyId')
    .notEmpty()
    .withMessage('insuranceCompanyId is required')
    .isInt({ min: 1 })
    .withMessage('insuranceCompanyId must be numeric'),
  body('name').notEmpty().withMessage('name is required').isString().withMessage('name must be a string'),
  body('groupNumber').optional().isString().withMessage('groupNumber must be a string'),
  body('notes').optional().isString().withMessage('notes must be a string'),
  body('feeSched').optional().isInt({ min: 1 }).withMessage('feeSched must be numeric'),
  body('allowedFeeSched').optional().isInt({ min: 1 }).withMessage('allowedFeeSched must be numeric'),
  body('copayFeeSched').optional().isInt({ min: 1 }).withMessage('copayFeeSched must be numeric'),
  body('filingCode').optional().isInt({ min: 1 }).withMessage('filingCode must be numeric'),
  body('filingCodeSubtype').optional().isInt({ min: 1 }).withMessage('filingCodeSubtype must be numeric'),
  body('planType').optional().isString().withMessage('planType must be a string'),
  body('monthRenew').optional().isInt({ min: 1, max: 12 }).withMessage('monthRenew must be between 1 and 12'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('benefits').optional().isArray().withMessage('benefits must be an array'),
];

export const insurancePlanUpdateValidator: ValidationChain[] = [
  body('name').optional().isString().withMessage('name must be a string'),
  body('groupNumber').optional().isString().withMessage('groupNumber must be a string'),
  body('notes').optional().isString().withMessage('notes must be a string'),
  body('feeSched').optional().isInt({ min: 1 }).withMessage('feeSched must be numeric'),
  body('allowedFeeSched').optional().isInt({ min: 1 }).withMessage('allowedFeeSched must be numeric'),
  body('copayFeeSched').optional().isInt({ min: 1 }).withMessage('copayFeeSched must be numeric'),
  body('filingCode').optional().isInt({ min: 1 }).withMessage('filingCode must be numeric'),
  body('filingCodeSubtype').optional().isInt({ min: 1 }).withMessage('filingCodeSubtype must be numeric'),
  body('planType').optional().isString().withMessage('planType must be a string'),
  body('monthRenew').optional().isInt({ min: 1, max: 12 }).withMessage('monthRenew must be between 1 and 12'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

export const coverageTemplatePayloadValidator: ValidationChain[] = [
  body('name').notEmpty().withMessage('name is required').isString().withMessage('name must be a string'),
  body('description').optional().isString().withMessage('description must be a string'),
  body('benefits').optional().isArray().withMessage('benefits must be an array'),
];
