import { body, ValidationChain } from 'express-validator';

export const createCoverageGroupValidator: ValidationChain[] = [
  body('name')
    .notEmpty()
    .withMessage('Group name is required')
    .isString()
    .withMessage('Group name must be a string'),
  body('codes').optional().isArray().withMessage('Codes must be an array'),
  body('frequency').optional().isObject().withMessage('Frequency must be an object'),
  body('limitations').optional().isObject().withMessage('Limitations must be an object'),
  body('downgrades').optional().isObject().withMessage('Downgrades must be an object'),
];
