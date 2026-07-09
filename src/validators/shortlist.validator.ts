import { body, ValidationChain } from 'express-validator';

export const createShortlistValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required'),
  body('providerId')
    .optional({ nullable: true, checkFalsy: true }),
  body('durationMins')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
  body('preferredDay')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('preferredTime')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  body('procedures')
    .optional({ nullable: true, checkFalsy: true })
    .isArray()
    .withMessage('Procedures must be an array'),
  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
];
