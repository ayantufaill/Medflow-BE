import { body, param, query, ValidationChain } from 'express-validator';

export const appointmentIdValidator: ValidationChain[] = [
  param('appointmentId')
    .notEmpty()
    .withMessage('Appointment ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid appointment ID format'),
];

export const providerIdValidator: ValidationChain[] = [
  param('providerId')
    .notEmpty()
    .withMessage('Provider ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
];

export const createAppointmentValidator: ValidationChain[] = [
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
    .optional()
    .isInt({ min: 1 })
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
    .isInt({ min: 1 })
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
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('providerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
  query('patientId')
    .optional()
    .isInt({ min: 1 })
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
    .isInt({ min: 1 })
    .withMessage('Invalid appointment type ID format'),
  query('search')
    .optional()
    .isString()
    .withMessage('search must be a string'),
];

export const scheduleQueryValidator: ValidationChain[] = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date'),
  query('date')
    .optional()
    .isISO8601()
    .withMessage('date must be a valid ISO 8601 date'),
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

export const appointmentWorkspaceValidator: ValidationChain[] = [
  body('referralSource')
    .optional()
    .isString()
    .withMessage('referralSource must be a string'),
  body('reminderPreferences')
    .optional()
    .isObject()
    .withMessage('reminderPreferences must be an object'),
  body('participants')
    .optional()
    .isArray()
    .withMessage('participants must be an array'),
  body('participants.*.providerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('participants.providerId must be a numeric ID'),
  body('participants.*.role')
    .optional()
    .isString()
    .withMessage('participants.role must be a string'),
  body('participants.*.minutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('participants.minutes must be a non-negative integer'),
  body('notes')
    .optional()
    .isArray()
    .withMessage('notes must be an array'),
  body('notes.*.message')
    .optional()
    .isString()
    .withMessage('notes.message must be a string'),
  body('systemEvents')
    .optional()
    .isArray()
    .withMessage('systemEvents must be an array'),
  body('systemEvents.*.message')
    .optional()
    .isString()
    .withMessage('systemEvents.message must be a string'),
  body('customFields')
    .optional()
    .isObject()
    .withMessage('customFields must be an object'),
];

export const appointmentProcedureValidator: ValidationChain[] = [
  body('code')
    .optional()
    .isString()
    .withMessage('code must be a string'),
  body('codeNum')
    .optional()
    .isInt({ min: 1 })
    .withMessage('codeNum must be a numeric ID'),
  body('description')
    .notEmpty()
    .withMessage('description is required')
    .isString()
    .withMessage('description must be a string'),
  body('tooth')
    .optional()
    .isString()
    .withMessage('tooth must be a string'),
  body('surface')
    .optional()
    .isString()
    .withMessage('surface must be a string'),
  body('fee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('fee must be a non-negative number'),
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('quantity must be at least 1'),
  body('status')
    .optional()
    .isString()
    .withMessage('status must be a string'),
  body('providerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('providerId must be a numeric ID'),
];

export const appointmentTagValidator: ValidationChain[] = [
  body('tag')
    .notEmpty()
    .withMessage('tag is required')
    .isString()
    .withMessage('tag must be a string'),
  body('color')
    .optional()
    .isString()
    .withMessage('color must be a string'),
];

export const appointmentLabOrderValidator: ValidationChain[] = [
  body('laboratoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('laboratoryId must be a numeric ID'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('dueDate must be a valid ISO 8601 date'),
  body('instructions')
    .optional()
    .isString()
    .withMessage('instructions must be a string'),
  body('labFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('labFee must be a non-negative number'),
  body('invoiceNumber')
    .optional()
    .isString()
    .withMessage('invoiceNumber must be a string'),
];

export const appointmentCommunicationValidator: ValidationChain[] = [
  body('patientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('patientId must be a numeric ID'),
  body('channel')
    .notEmpty()
    .withMessage('channel is required')
    .isIn(['text', 'email', 'call_note', 'review_request', 'welcome', 'portal_invite', 'quick_payment', 'update_request'])
    .withMessage('Invalid channel'),
  body('message')
    .notEmpty()
    .withMessage('message is required')
    .isString()
    .withMessage('message must be a string'),
  body('subject')
    .optional()
    .isString()
    .withMessage('subject must be a string'),
];
