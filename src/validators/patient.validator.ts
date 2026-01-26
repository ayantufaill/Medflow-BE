import { body, param, query, ValidationChain } from 'express-validator';

export const patientIdValidator: ValidationChain[] = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid patient ID format'),
];

export const createPatientValidator: ValidationChain[] = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('middleName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Middle name must be less than 50 characters'),
  body('preferredName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Preferred name must be less than 50 characters'),
  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'])
    .withMessage('Gender must be one of: male, female, non_binary, prefer_not_to_say, unknown'),
  body('ssn')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Optional field
      }
      // Remove hyphens for validation
      const digitsOnly = value.replace(/-/g, '');
      // Must be exactly 9 digits
      if (digitsOnly.length !== 9) {
        throw new Error('SSN must contain exactly 9 digits');
      }
      // Must contain only numbers
      if (!/^\d+$/.test(digitsOnly)) {
        throw new Error('SSN must contain only numbers');
      }
      return true;
    }),
  body('phonePrimary')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Optional field
      }
      // Remove + and spaces for validation (E.164 format)
      const cleanPhone = value.replace(/^\+/, '').replace(/\s/g, '');
      // E.164 format: 7-15 digits (country code + subscriber number)
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        throw new Error('Phone number must be between 7 and 15 digits');
      }
      // Must contain only digits
      if (!/^\d+$/.test(cleanPhone)) {
        throw new Error('Phone number must contain only digits');
      }
      return true;
    }),
  body('phoneSecondary')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Optional field
      }
      // Remove + and spaces for validation (E.164 format)
      const cleanPhone = value.replace(/^\+/, '').replace(/\s/g, '');
      // E.164 format: 7-15 digits (country code + subscriber number)
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        throw new Error('Phone number must be between 7 and 15 digits');
      }
      // Must contain only digits
      if (!/^\d+$/.test(cleanPhone)) {
        throw new Error('Phone number must contain only digits');
      }
      return true;
    }),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('address.line1')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Address line 1 must be less than 100 characters'),
  body('address.line2')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Address line 2 must be less than 100 characters'),
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City must be less than 50 characters'),
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State must be less than 50 characters'),
  body('address.postalCode')
    .optional()
    .trim()
    .matches(/^[A-Za-z0-9][A-Za-z0-9\s\-]{1,10}$/)
    .withMessage('Postal code must be in format XXXXX or XXXXX-XXXX'),
  body('emergencyContact.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Emergency contact name must be less than 100 characters'),
  body('emergencyContact.relationship')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Emergency contact relationship must be less than 50 characters'),
  body('emergencyContact.phone')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Optional field
      }
      // Remove + and spaces for validation (E.164 format)
      const cleanPhone = value.replace(/^\+/, '').replace(/\s/g, '');
      // E.164 format: 7-15 digits (country code + subscriber number)
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        throw new Error('Phone number must be between 7 and 15 digits');
      }
      // Must contain only digits
      if (!/^\d+$/.test(cleanPhone)) {
        throw new Error('Phone number must contain only digits');
      }
      return true;
    }),
  body('preferredLanguage')
    .optional()
    .trim()
    .isIn(['en', 'es', 'fr', 'de', 'zh', 'ar', 'hi', 'pt', 'ru', 'ja'])
    .withMessage('Preferred language must be a valid language code'),
  body('communicationPreference')
    .optional()
    .isIn(['phone', 'email', 'sms', 'portal'])
    .withMessage('Communication preference must be one of: phone, email, sms, portal'),
  body('userAccountId')
    .optional()
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid user account ID format'),
  body('referralSource')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Referral source must be less than 100 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

export const updatePatientValidator: ValidationChain[] = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('middleName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Middle name must be less than 50 characters'),
  body('preferredName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Preferred name must be less than 50 characters'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'])
    .withMessage('Gender must be one of: male, female, non_binary, prefer_not_to_say, unknown'),
  body('ssn')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Optional field
      }
      // Remove hyphens for validation
      const digitsOnly = value.replace(/-/g, '');
      // Must be exactly 9 digits
      if (digitsOnly.length !== 9) {
        throw new Error('SSN must contain exactly 9 digits');
      }
      // Must contain only numbers
      if (!/^\d+$/.test(digitsOnly)) {
        throw new Error('SSN must contain only numbers');
      }
      return true;
    }),
  body('phonePrimary')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Optional field
      }
      // Remove + and spaces for validation (E.164 format)
      const cleanPhone = value.replace(/^\+/, '').replace(/\s/g, '');
      // E.164 format: 7-15 digits (country code + subscriber number)
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        throw new Error('Phone number must be between 7 and 15 digits');
      }
      // Must contain only digits
      if (!/^\d+$/.test(cleanPhone)) {
        throw new Error('Phone number must contain only digits');
      }
      return true;
    }),
  body('phoneSecondary')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Optional field
      }
      // Remove + and spaces for validation (E.164 format)
      const cleanPhone = value.replace(/^\+/, '').replace(/\s/g, '');
      // E.164 format: 7-15 digits (country code + subscriber number)
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        throw new Error('Phone number must be between 7 and 15 digits');
      }
      // Must contain only digits
      if (!/^\d+$/.test(cleanPhone)) {
        throw new Error('Phone number must contain only digits');
      }
      return true;
    }),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('address.line1')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Address line 1 must be less than 100 characters'),
  body('address.line2')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Address line 2 must be less than 100 characters'),
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City must be less than 50 characters'),
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State must be less than 50 characters'),
  body('address.postalCode')
    .optional()
    .trim()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Postal code must be in format XXXXX or XXXXX-XXXX'),
  body('emergencyContact.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Emergency contact name must be less than 100 characters'),
  body('emergencyContact.relationship')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Emergency contact relationship must be less than 50 characters'),
  body('emergencyContact.phone')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Optional field
      }
      // Remove + and spaces for validation (E.164 format)
      const cleanPhone = value.replace(/^\+/, '').replace(/\s/g, '');
      // E.164 format: 7-15 digits (country code + subscriber number)
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        throw new Error('Phone number must be between 7 and 15 digits');
      }
      // Must contain only digits
      if (!/^\d+$/.test(cleanPhone)) {
        throw new Error('Phone number must contain only digits');
      }
      return true;
    }),
  body('preferredLanguage')
    .optional()
    .trim()
    .isIn(['en', 'es', 'fr', 'de', 'zh', 'ar', 'hi', 'pt', 'ru', 'ja'])
    .withMessage('Preferred language must be a valid language code'),
  body('communicationPreference')
    .optional()
    .isIn(['phone', 'email', 'sms', 'portal'])
    .withMessage('Communication preference must be one of: phone, email, sms, portal'),
  body('portalAccessEnabled')
    .optional()
    .isBoolean()
    .withMessage('portalAccessEnabled must be a boolean'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('lastVisitDate')
    .optional()
    .isISO8601()
    .withMessage('Last visit date must be a valid date'),
  body('referralSource')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Referral source must be less than 100 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

export const patientSearchValidator: ValidationChain[] = [
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
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
];

