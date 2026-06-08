import { param, body } from 'express-validator';

export const categoryParamValidator = [
  param('category')
    .isInt({ min: 1 })
    .withMessage('Category must be a positive integer'),
];

export const defNumParamValidator = [
  param('defNum')
    .custom((val) => {
      try {
        BigInt(val);
        return true;
      } catch {
        throw new Error('defNum must be a valid big integer');
      }
    }),
];

export const keyParamValidator = [
  param('key')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Setting key must be a non-empty string'),
];

export const createDefinitionValidator = [
  body('name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name must be a non-empty string'),
  body('value')
    .optional()
    .isString()
    .withMessage('Value must be a string'),
  body('itemOrder')
    .optional()
    .isInt()
    .withMessage('ItemOrder must be an integer'),
];

export const updateDefinitionValidator = [
  body('name')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name must be a non-empty string if provided'),
  body('value')
    .optional()
    .isString()
    .withMessage('Value must be a string'),
  body('isHidden')
    .optional()
    .isBoolean()
    .withMessage('isHidden must be a boolean'),
  body('itemOrder')
    .optional()
    .isInt()
    .withMessage('ItemOrder must be an integer'),
];
