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
  body('amount')
    .optional()
    .custom((val) => typeof val === 'string' || typeof val === 'number')
    .withMessage('Amount must be a string or number'),
  body('percent')
    .optional()
    .custom((val) => typeof val === 'string' || typeof val === 'number')
    .withMessage('Percent must be a string or number'),
  body('note')
    .optional()
    .isString()
    .withMessage('Note must be a string'),
  body('depositSlip')
    .optional()
    .isBoolean()
    .withMessage('depositSlip must be a boolean'),
  body('openEdge')
    .optional()
    .isBoolean()
    .withMessage('openEdge must be a boolean'),
  body('prosperipay')
    .optional()
    .isBoolean()
    .withMessage('prosperipay must be a boolean'),
  body('smilepay')
    .optional()
    .isBoolean()
    .withMessage('smilepay must be a boolean'),
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
  body('amount')
    .optional()
    .custom((val) => typeof val === 'string' || typeof val === 'number')
    .withMessage('Amount must be a string or number'),
  body('percent')
    .optional()
    .custom((val) => typeof val === 'string' || typeof val === 'number')
    .withMessage('Percent must be a string or number'),
  body('note')
    .optional()
    .isString()
    .withMessage('Note must be a string'),
  body('depositSlip')
    .optional()
    .isBoolean()
    .withMessage('depositSlip must be a boolean'),
  body('openEdge')
    .optional()
    .isBoolean()
    .withMessage('openEdge must be a boolean'),
  body('prosperipay')
    .optional()
    .isBoolean()
    .withMessage('prosperipay must be a boolean'),
  body('smilepay')
    .optional()
    .isBoolean()
    .withMessage('smilepay must be a boolean'),
];
