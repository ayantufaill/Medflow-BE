import { body, param, query, ValidationChain } from 'express-validator';

export const recurringAppointmentIdValidator: ValidationChain[] = [
  param('recurringAppointmentId')
    .notEmpty()
    .withMessage('Recurring appointment ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid recurring appointment ID format'),
];

export const createRecurringAppointmentValidator: ValidationChain[] = [
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
  body('frequency')
    .notEmpty()
    .withMessage('Frequency is required')
    .isIn(['weekly', 'monthly', 'quarterly'])
    .withMessage('Frequency must be one of: weekly, monthly, quarterly'),
  body('frequencyValue')
    .notEmpty()
    .withMessage('Frequency value is required')
    .isInt({ min: 1, max: 52 })
    .withMessage('Frequency value must be between 1 and 52'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  body('preferredTime')
    .notEmpty()
    .withMessage('Preferred time is required')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Preferred time must be in HH:MM format (24-hour)'),
  body('preferredDayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Preferred day of week must be between 0 (Sunday) and 6 (Saturday)'),
  body('totalAppointments')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Total appointments must be between 1 and 100'),
];

export const updateRecurringAppointmentValidator: ValidationChain[] = [
  body('appointmentTypeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid appointment type ID format'),
  body('frequency')
    .optional()
    .isIn(['weekly', 'monthly', 'quarterly'])
    .withMessage('Frequency must be one of: weekly, monthly, quarterly'),
  body('frequencyValue')
    .optional()
    .isInt({ min: 1, max: 52 })
    .withMessage('Frequency value must be between 1 and 52'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  body('preferredTime')
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Preferred time must be in HH:MM format (24-hour)'),
  body('preferredDayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Preferred day of week must be between 0 (Sunday) and 6 (Saturday)'),
  body('totalAppointments')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Total appointments must be between 1 and 100'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const generateAppointmentsValidator: ValidationChain[] = [
  body('count')
    .notEmpty()
    .withMessage('Count is required')
    .isInt({ min: 1 })
    .withMessage('Count must be a positive integer'),
];

export const recurringAppointmentQueryValidator: ValidationChain[] = [
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
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be either true or false'),
  query('search')
    .optional()
    .isString()
    .withMessage('search must be a string'),
  query('startDateFrom')
    .optional()
    .isISO8601()
    .withMessage('startDateFrom must be a valid ISO 8601 date'),
  query('startDateTo')
    .optional()
    .isISO8601()
    .withMessage('startDateTo must be a valid ISO 8601 date'),
];
