import { body, param, query, ValidationChain } from 'express-validator';

export const practiceInfoIdValidator: ValidationChain[] = [
  param('practiceInfoId')
    .notEmpty()
    .withMessage('Practice info ID is required')
    .isString()
    .trim()
    .isInt({ min: 1 })
    .withMessage('Invalid practice info ID format'),
];

export const createPracticeInfoValidator: ValidationChain[] = [
  body('practiceName')
    .trim()
    .notEmpty()
    .withMessage('Practice name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Practice name must be between 2 and 200 characters'),
  body('taxId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Tax ID must be between 1 and 50 characters'),
  body('npiNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('NPI number must be between 1 and 50 characters'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('fax')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid fax number'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('website')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: false })
    .withMessage('Please provide a valid website URL'),
  body('address')
    .notEmpty()
    .withMessage('Address is required')
    .isObject()
    .withMessage('Address must be an object'),
  body('address.line1')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 1 must be at most 200 characters'),
  body('address.line2')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 2 must be at most 200 characters'),
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City must be at most 100 characters'),
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must be at most 100 characters'),
  body('address.postalCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postal code must be at most 20 characters'),
  body('logoPath')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Logo path must be at most 500 characters'),
  body('businessHours')
    .optional()
    .isObject()
    .withMessage('Business hours must be an object'),
  body('timezone')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Timezone must be at most 50 characters'),
  body('appointmentBufferMinutes')
    .optional()
    .isInt({ min: 0, max: 1440 })
    .withMessage('Appointment buffer minutes must be between 0 and 1440'),
  body('billingContactEmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid billing contact email address')
    .normalizeEmail()
    .toLowerCase(),
  body('billingOutOfNetwork')
    .optional()
    .isIn(['yes', 'no'])
    .withMessage('Billing Out of Network must be "yes" or "no"'),
  body('billingAssignmentType')
    .optional()
    .isIn(['in-assignment', 'non-assignment'])
    .withMessage('Billing Assignment Type must be "in-assignment" or "non-assignment"'),
  body('billingProvider')
    .optional()
    .isIn(['default', 'treating', 'business'])
    .withMessage('Billing Provider must be "default", "treating", or "business"'),
  body('kioskPassword')
    .optional()
    .isString()
    .withMessage('Kiosk password must be a string'),
  body('kioskAccounts')
    .optional()
    .isArray()
    .withMessage('Kiosk accounts must be an array'),
  body('myChartSettings')
    .optional()
    .isObject()
    .withMessage('MyChart settings must be an object'),
  body('officeTimings')
    .optional()
    .isObject()
    .withMessage('Office timings must be an object'),
  body('onlineSchedule')
    .optional()
    .isObject()
    .withMessage('Online schedule must be an object'),
  body('patientFlags')
    .optional()
    .isArray()
    .withMessage('Patient flags must be an array'),
  body('documentCategories')
    .optional()
    .isObject()
    .withMessage('Document categories must be an object'),
  body('scheduleConfig')
    .optional()
    .isObject()
    .withMessage('Schedule config must be an object'),
  body('practiceSettings')
    .optional()
    .isObject()
    .withMessage('Practice settings must be an object'),
];

export const updatePracticeInfoValidator: ValidationChain[] = [
  body('practiceName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Practice name must be between 2 and 200 characters'),
  body('taxId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Tax ID must be between 1 and 50 characters'),
  body('npiNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('NPI number must be between 1 and 50 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('fax')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid fax number'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('website')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: false })
    .withMessage('Please provide a valid website URL'),
  body('address')
    .optional()
    .isObject()
    .withMessage('Address must be an object'),
  body('address.line1')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 1 must be at most 200 characters'),
  body('address.line2')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 2 must be at most 200 characters'),
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City must be at most 100 characters'),
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State must be at most 100 characters'),
  body('address.postalCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postal code must be at most 20 characters'),
  body('logoPath')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Logo path must be at most 500 characters'),
  body('businessHours')
    .optional()
    .isObject()
    .withMessage('Business hours must be an object'),
  body('timezone')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Timezone must be at most 50 characters'),
  body('appointmentBufferMinutes')
    .optional()
    .isInt({ min: 0, max: 1440 })
    .withMessage('Appointment buffer minutes must be between 0 and 1440'),
  body('billingContactEmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid billing contact email address')
    .normalizeEmail()
    .toLowerCase(),
  body('billingOutOfNetwork')
    .optional()
    .isIn(['yes', 'no'])
    .withMessage('Billing Out of Network must be "yes" or "no"'),
  body('billingAssignmentType')
    .optional()
    .isIn(['in-assignment', 'non-assignment'])
    .withMessage('Billing Assignment Type must be "in-assignment" or "non-assignment"'),
  body('billingProvider')
    .optional()
    .isIn(['default', 'treating', 'business'])
    .withMessage('Billing Provider must be "default", "treating", or "business"'),
  body('kioskPassword')
    .optional()
    .isString()
    .withMessage('Kiosk password must be a string'),
  body('kioskAccounts')
    .optional()
    .isArray()
    .withMessage('Kiosk accounts must be an array'),
  body('myChartSettings')
    .optional()
    .isObject()
    .withMessage('MyChart settings must be an object'),
  body('officeTimings')
    .optional()
    .isObject()
    .withMessage('Office timings must be an object'),
  body('onlineSchedule')
    .optional()
    .isObject()
    .withMessage('Online schedule must be an object'),
  body('patientFlags')
    .optional()
    .isArray()
    .withMessage('Patient flags must be an array'),
  body('documentCategories')
    .optional()
    .isObject()
    .withMessage('Document categories must be an object'),
  body('scheduleConfig')
    .optional()
    .isObject()
    .withMessage('Schedule config must be an object'),
  body('practiceSettings')
    .optional()
    .isObject()
    .withMessage('Practice settings must be an object'),
];

export const queryValidator: ValidationChain[] = [
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
];

