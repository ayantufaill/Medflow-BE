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
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('Invalid user ID format'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters'),
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
  body('color')
    .optional()
    .isString()
    .withMessage('color must be a string'),
];

export const updateProviderValidator: ValidationChain[] = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters'),
  body('middleName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Middle name must be less than 50 characters'),
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
    .isString()
    .isLength({ max: 50 })
    .withMessage('Title must be a string with max 50 characters'),
  body('prefix')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Prefix must be a string with max 50 characters'),
  body('suffix')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Suffix must be a string with max 50 characters'),
  body('preferredName')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('Preferred name must be less than 100 characters'),
  body('internalCodeName')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Internal code name must be less than 50 characters'),
  body('email')
    .optional()
    .trim(),
  body('mobilePhone')
    .optional()
    .isString(),
  body('homePhone')
    .optional()
    .isString(),
  body('organizationName')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Organization name must be less than 200 characters'),
  body('federalTaxNumber')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Federal tax number must be less than 50 characters'),
  body('additionalProviderId')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Additional provider ID must be less than 50 characters'),
  body('dea')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('DEA number must be less than 50 characters'),
  body('taxIdType')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Tax ID type must be less than 50 characters'),
  body('providerType')
    .optional()
    .isString(),
  body('signatureOnFile')
    .optional()
    .isBoolean()
    .withMessage('signatureOnFile must be a boolean'),
  body('defaultDentist')
    .optional()
    .isBoolean()
    .withMessage('defaultDentist must be a boolean'),
  body('defaultHygienist')
    .optional()
    .isBoolean()
    .withMessage('defaultHygienist must be a boolean'),
  body('country')
    .optional()
    .isString(),
  body('addressLine1')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Address line 1 must be less than 200 characters'),
  body('addressLine2')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Address line 2 must be less than 200 characters'),
  body('city')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('City must be less than 100 characters'),
  body('state')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('State must be less than 100 characters'),
  body('zipCode')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('Zip code must be less than 20 characters'),
  body('openEdgeToken')
    .optional()
    .isString(),
  body('openDentalProviderId')
    .optional()
    .isString(),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('branchIds')
    .optional()
    .isArray()
    .withMessage('branchIds must be an array'),
  body('carriersOutOfNetwork')
    .optional()
    .isArray()
    .withMessage('carriersOutOfNetwork must be an array'),
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
  body('color')
    .optional()
    .isString()
    .withMessage('color must be a string'),
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
