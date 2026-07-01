import { body, param, query, ValidationChain } from 'express-validator';

export const waitlistEntryIdValidator: ValidationChain[] = [
  param('waitlistEntryId')
    .notEmpty()
    .withMessage('Waitlist entry ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid waitlist entry ID format'),
];

export const createWaitlistEntryValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('providerId')
    .notEmpty()
    .withMessage('Provider ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
  body('appointmentTypeId')
    .notEmpty()
    .withMessage('Appointment type ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid appointment type ID format'),
  body('preferredDate')
    .optional()
    .isISO8601()
    .withMessage('Preferred date must be a valid ISO 8601 date'),
  body('preferredTimeStart')
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Preferred time start must be in HH:MM format (24-hour)'),
  body('preferredTimeEnd')
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Preferred time end must be in HH:MM format (24-hour)'),
  body('priority')
    .optional()
    .isIn(['urgent', 'normal', 'flexible'])
    .withMessage('Priority must be one of: urgent, normal, flexible'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

export const updateWaitlistEntryValidator: ValidationChain[] = [
  body('appointmentTypeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid appointment type ID format'),
  body('preferredDate')
    .optional()
    .isISO8601()
    .withMessage('Preferred date must be a valid ISO 8601 date'),
  body('preferredTimeStart')
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Preferred time start must be in HH:MM format (24-hour)'),
  body('preferredTimeEnd')
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Preferred time end must be in HH:MM format (24-hour)'),
  body('priority')
    .optional()
    .isIn(['urgent', 'normal', 'flexible'])
    .withMessage('Priority must be one of: urgent, normal, flexible'),
  body('status')
    .optional()
    .isIn(['active', 'called', 'scheduled', 'expired'])
    .withMessage('Status must be one of: active, called, scheduled, expired'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

export const waitlistQueryValidator: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('patientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  query('providerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
  query('status')
    .optional()
    .isIn(['active', 'called', 'scheduled', 'expired'])
    .withMessage('Invalid status'),
  query('priority')
    .optional()
    .isIn(['urgent', 'normal', 'flexible'])
    .withMessage('Invalid priority'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('dateFrom must be a valid ISO 8601 date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('dateTo must be a valid ISO 8601 date'),
];

export const convertWaitlistToAppointmentValidator: ValidationChain[] = [
  body('appointmentDate')
    .notEmpty()
    .withMessage('Appointment date is required')
    .isISO8601()
    .withMessage('Appointment date must be a valid ISO 8601 date'),
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .notEmpty()
    .withMessage('End time is required')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 5 })
    .withMessage('Duration must be at least 5 minutes'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  body('roomId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Room ID must be less than 100 characters'),
  body('chiefComplaint')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Chief complaint must be less than 500 characters'),
];
