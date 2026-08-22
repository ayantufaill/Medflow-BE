import { body, query, type ValidationChain } from 'express-validator';

const isNumericIdString = (value: unknown) =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

const idValidator = (field: string, label: string, source: 'body' | 'query') => {
  const chain = source === 'body' ? body(field) : query(field);
  return chain
    .notEmpty()
    .withMessage(`${label} is required`)
    .custom((value) => isNumericIdString(value))
    .withMessage(`Invalid ${label.toLowerCase()} format`);
};

export const publicSlotsQueryValidator: ValidationChain[] = [
  idValidator('branchId', 'Branch ID', 'query'),
  idValidator('providerId', 'Provider ID', 'query'),
  idValidator('appointmentTypeId', 'Appointment type ID', 'query'),
  query('date').notEmpty().withMessage('date is required').isISO8601().withMessage('date must be a valid ISO8601 date'),
];

export const publicGuestBookingValidator: ValidationChain[] = [
  idValidator('branchId', 'Branch ID', 'body'),
  idValidator('providerId', 'Provider ID', 'body'),
  idValidator('appointmentTypeId', 'Appointment type ID', 'body'),
  body('appointmentDate')
    .notEmpty()
    .withMessage('appointmentDate is required')
    .isISO8601()
    .withMessage('appointmentDate must be a valid ISO8601 date'),
  body('startTime')
    .notEmpty()
    .withMessage('startTime is required')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('startTime must be in HH:MM format'),
  body('chiefComplaint')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('chiefComplaint must be a string of at most 500 characters'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('firstName is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('firstName must be at most 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('lastName is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('lastName must be at most 50 characters'),
  body('dateOfBirth')
    .notEmpty()
    .withMessage('dateOfBirth is required')
    .isISO8601()
    .withMessage('dateOfBirth must be a valid ISO8601 date')
    .custom((value) => new Date(value) < new Date())
    .withMessage('dateOfBirth must be in the past'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body().custom((value) => {
    if (!value.phone && !value.email) {
      throw new Error('At least one of phone or email is required');
    }
    return true;
  }),
];
