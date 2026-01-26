import { body, param, query, ValidationChain } from 'express-validator';

export const appointmentIdValidator: ValidationChain[] = [
  param('appointmentId')
    .notEmpty()
    .withMessage('Appointment ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid appointment ID format'),
];

export const providerIdValidator: ValidationChain[] = [
  param('providerId')
    .notEmpty()
    .withMessage('Provider ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid provider ID format'),
];

export const createAppointmentValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid patient ID format'),
  body('providerId')
    .notEmpty()
    .withMessage('Provider ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid provider ID format'),
  body('appointmentTypeId')
    .optional()
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid appointment type ID format'),
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
  body('chiefComplaint')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Chief complaint must be less than 500 characters'),
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
  body('requiresInterpreter')
    .optional()
    .isBoolean()
    .withMessage('requiresInterpreter must be a boolean'),
  body('interpreterLanguage')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Interpreter language must be less than 50 characters'),
  body('insuranceVerified')
    .optional()
    .isBoolean()
    .withMessage('insuranceVerified must be a boolean'),
  body('copayCollected')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Copay collected must be a non-negative number'),
  body('reminderSent')
    .optional()
    .isBoolean()
    .withMessage('reminderSent must be a boolean'),
  body('customFields')
    .optional()
    .isObject()
    .withMessage('customFields must be an object'),
];

export const updateAppointmentValidator: ValidationChain[] = [
  body('appointmentTypeId')
    .optional()
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid appointment type ID format'),
  body('appointmentDate')
    .optional()
    .isISO8601()
    .withMessage('Appointment date must be a valid ISO 8601 date'),
  body('startTime')
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 5 })
    .withMessage('Duration must be at least 5 minutes'),
  body('status')
    .optional()
    .isIn(['scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'])
    .withMessage('Status must be one of: scheduled, confirmed, checked_in, completed, cancelled, no_show'),
  body('chiefComplaint')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Chief complaint must be less than 500 characters'),
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
  body('requiresInterpreter')
    .optional()
    .isBoolean()
    .withMessage('requiresInterpreter must be a boolean'),
  body('interpreterLanguage')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Interpreter language must be less than 50 characters'),
  body('insuranceVerified')
    .optional()
    .isBoolean()
    .withMessage('insuranceVerified must be a boolean'),
  body('copayCollected')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Copay collected must be a non-negative number'),
  body('reminderSent')
    .optional()
    .isBoolean()
    .withMessage('reminderSent must be a boolean'),
  body('cancellationReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason must be less than 500 characters'),
  body('customFields')
    .optional()
    .isObject()
    .withMessage('customFields must be an object'),
];

export const rescheduleAppointmentValidator: ValidationChain[] = [
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
];

export const cancelAppointmentValidator: ValidationChain[] = [
  body('cancellationReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason must be less than 500 characters'),
];

export const appointmentQueryValidator: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('providerId')
    .optional()
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid provider ID format'),
  query('patientId')
    .optional()
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid patient ID format'),
  query('status')
    .optional()
    .isIn(['scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'])
    .withMessage('Invalid status'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('appointmentTypeId')
    .optional()
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid appointment type ID format'),
];

export const scheduleQueryValidator: ValidationChain[] = [
  query('startDate')
    .notEmpty()
    .withMessage('startDate is required')
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate')
    .notEmpty()
    .withMessage('endDate is required')
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date'),
  query('view')
    .optional()
    .isIn(['day', 'week', 'month'])
    .withMessage('View must be one of: day, week, month'),
];

export const availableSlotsQueryValidator: ValidationChain[] = [
  query('date')
    .notEmpty()
    .withMessage('date is required')
    .isISO8601()
    .withMessage('date must be a valid ISO 8601 date'),
  query('durationMinutes')
    .optional()
    .isInt({ min: 5 })
    .withMessage('Duration must be at least 5 minutes'),
];
