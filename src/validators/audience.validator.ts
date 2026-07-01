import { body, param, type ValidationChain } from 'express-validator';

export const saveAudienceValidator: ValidationChain[] = [
  body('name').isString().notEmpty().withMessage('Audience name is required'),
  body('kind').isIn(['Patient', 'Procedures']).withMessage('Invalid audience kind'),
  body('filters').optional().isArray().withMessage('Filters must be an array'),
];

export const audienceIdParamValidator: ValidationChain[] = [
  param('audienceId').isString().notEmpty().withMessage('audienceId is required'),
];
