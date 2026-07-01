import { body, param, query, ValidationChain } from 'express-validator';

export const providerIdValidator: ValidationChain[] = [
  param('providerId')
    .notEmpty()
    .withMessage('Provider ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
];

export const createProviderValidator: ValidationChain[] = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid user ID format'),
  body('npiNumber')
    .notEmpty()
    .withMessage('NPI number is required')
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage('NPI number must be exactly 10 digits')
    .matches(/^\d+$/)
    .withMessage('NPI number must contain only digits'),
  body('licenseNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('License number must be less than 50 characters'),
  body('specialty')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null) return true;

      if (typeof value === 'string') {
        return value.trim().length <= 100;
      }

      if (Array.isArray(value)) {
        return value.every(
          (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100,
        );
      }

      return false;
    })
    .withMessage('Specialty must be a string or an array of strings (each <= 100 chars)'),
  body('title')
    .optional()
    .isIn(['MD', 'DO', 'NP', 'PA', 'RN', 'LPN', 'Other'])
    .withMessage('Title must be one of: MD, DO, NP, PA, RN, LPN, Other'),
  body('appointmentBufferMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Appointment buffer minutes must be a non-negative integer'),
  body('maxDailyAppointments')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max daily appointments must be a positive integer'),
  body('consultationFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Consultation fee must be a non-negative number'),
  body('isAcceptingNewPatients')
    .optional()
    .isBoolean()
    .withMessage('isAcceptingNewPatients must be a boolean'),
  body('workingHours')
    .optional()
    .isArray()
    .withMessage('workingHours must be an array'),
  body('workingHours.*.dayOfWeek')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 (Sunday) and 6 (Saturday)'),
  body('workingHours.*.startTime')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('workingHours.*.endTime')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('workingHours.*.isAvailable')
    .optional()
    .isBoolean()
    .withMessage('isAvailable must be a boolean'),
  body('telehealthEnabled')
    .optional()
    .isBoolean()
    .withMessage('telehealthEnabled must be a boolean'),
];

export const updateProviderValidator: ValidationChain[] = [
  body('npiNumber')
    .optional()
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage('NPI number must be exactly 10 digits')
    .matches(/^\d+$/)
    .withMessage('NPI number must contain only digits'),
  body('licenseNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('License number must be less than 50 characters'),
  body('specialty')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null) return true;

      if (typeof value === 'string') {
        return value.trim().length <= 100;
      }

      if (Array.isArray(value)) {
        return value.every(
          (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100,
        );
      }

      return false;
    })
    .withMessage('Specialty must be a string or an array of strings (each <= 100 chars)'),
  body('title')
    .optional()
    .isIn(['MD', 'DO', 'NP', 'PA', 'RN', 'LPN', 'Other'])
    .withMessage('Title must be one of: MD, DO, NP, PA, RN, LPN, Other'),
  body('appointmentBufferMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Appointment buffer minutes must be a non-negative integer'),
  body('maxDailyAppointments')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max daily appointments must be a positive integer'),
  body('consultationFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Consultation fee must be a non-negative number'),
  body('isAcceptingNewPatients')
    .optional()
    .isBoolean()
    .withMessage('isAcceptingNewPatients must be a boolean'),
  body('workingHours')
    .optional()
    .isArray()
    .withMessage('workingHours must be an array'),
  body('workingHours.*.dayOfWeek')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 (Sunday) and 6 (Saturday)'),
  body('workingHours.*.startTime')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('workingHours.*.endTime')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('workingHours.*.isAvailable')
    .optional()
    .isBoolean()
    .withMessage('isAvailable must be a boolean'),
  body('telehealthEnabled')
    .optional()
    .isBoolean()
    .withMessage('telehealthEnabled must be a boolean'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const providerQueryValidator: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  query('specialty')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Specialty must be between 1 and 100 characters'),
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be either true or false'),
];

export const providerAvailabilityQueryValidator: ValidationChain[] = [
  query('date')
    .optional()
    .isISO8601()
    .withMessage('date must be a valid ISO 8601 date'),
  query('weekOf')
    .optional()
    .isISO8601()
    .withMessage('weekOf must be a valid ISO 8601 date'),
  query('durationMinutes')
    .optional()
    .isInt({ min: 5 })
    .withMessage('Duration must be at least 5 minutes'),
  query().custom((value, { req }) => {
    if (!req.query?.date && !req.query?.weekOf) {
      throw new Error('At least one of date or weekOf is required');
    }
    return true;
  }),
];
