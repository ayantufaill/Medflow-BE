import { query, param, body } from 'express-validator';

export const patientIdParamValidator = [
  param('patientId')
    .isInt({ min: 1 })
    .withMessage('Patient ID must be a valid integer.'),
];

export const saveAdjunctiveTherapyValidator = [
  body('products')
    .optional()
    .isArray()
    .withMessage('Products must be an array.'),
  body('labFees')
    .optional()
    .isArray()
    .withMessage('Lab fees must be an array.'),
  body('hygieneTools')
    .optional()
    .isArray()
    .withMessage('Hygiene tools must be an array.'),
  body('fluoride')
    .optional()
    .isObject()
    .withMessage('Fluoride must be an object.'),
  body('toothbrush')
    .optional()
    .isObject()
    .withMessage('Toothbrush must be an object.'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string.'),
];
