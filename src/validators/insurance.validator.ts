import { body, param, query, ValidationChain } from 'express-validator';

export const insuranceCompanyIdValidator: ValidationChain[] = [
  param('insuranceCompanyId')
    .notEmpty()
    .withMessage('Insurance company ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid insurance company ID format'),
];

export const createInsuranceCompanyValidator: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Insurance company name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('payerId')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Payer ID must be less than 20 characters'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('addressLine1')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 1 must be less than 200 characters'),
  body('addressLine2')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 2 must be less than 200 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City must be less than 50 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State must be less than 50 characters'),
  body('zipCode')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Zip code must be in format XXXXX or XXXXX-XXXX'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('fax')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Fax must be less than 30 characters'),
  body('website')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Website must be less than 200 characters'),
  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country must be less than 100 characters'),
  body('claimType')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Claim type must be less than 50 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must be less than 2000 characters'),
  body('providersOutOfNetwork')
    .optional()
    .isArray()
    .withMessage('Providers out of network must be an array'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const updateInsuranceCompanyValidator: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('payerId')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Payer ID must be less than 20 characters'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('addressLine1')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 1 must be less than 200 characters'),
  body('addressLine2')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address line 2 must be less than 200 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City must be less than 50 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State must be less than 50 characters'),
  body('zipCode')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Zip code must be in format XXXXX or XXXXX-XXXX'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('fax')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Fax must be less than 30 characters'),
  body('website')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Website must be less than 200 characters'),
  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country must be less than 100 characters'),
  body('claimType')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Claim type must be less than 50 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must be less than 2000 characters'),
  body('providersOutOfNetwork')
    .optional()
    .isArray()
    .withMessage('Providers out of network must be an array'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const patientInsuranceIdValidator: ValidationChain[] = [
  param('patientInsuranceId')
    .notEmpty()
    .withMessage('Patient insurance ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient insurance ID format'),
];

export const createPatientInsuranceValidator: ValidationChain[] = [
  body('insuranceCompanyId')
    .notEmpty()
    .withMessage('Insurance company ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid insurance company ID format'),
  body('policyNumber')
    .trim()
    .notEmpty()
    .withMessage('Policy number is required')
    .isLength({ min: 5, max: 30 })
    .withMessage('Policy number must be between 5 and 30 characters')
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage('Policy number must be alphanumeric only (no special symbols)'),
  body('groupNumber')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Group number must not exceed 30 characters')
    .matches(/^[A-Za-z0-9]*$/)
    .withMessage('Group number must be alphanumeric only'),
  body('groupName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Group name must be less than 100 characters'),
  body('subscriberName')
    .trim()
    .notEmpty()
    .withMessage('Subscriber name is required')
    .isLength({ max: 100 })
    .withMessage('Subscriber name must be less than 100 characters')
    .matches(/^[A-Za-z\s'-]+$/)
    .withMessage('Subscriber name can only contain letters, hyphens, and apostrophes'),
  body('subscriberDateOfBirth')
    .notEmpty()
    .withMessage('Subscriber date of birth is required')
    .isISO8601()
    .withMessage('Subscriber date of birth must be a valid date')
    .custom((value) => {
      const dob = new Date(value);
      const today = new Date();
      if (dob > today) {
        throw new Error('Date of birth must be in the past');
      }
      // Calculate age accurately considering month and day
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age >= 120) {
        throw new Error('Subscriber age must be less than 120 years');
      }
      return true;
    }),
  body('relationshipToPatient')
    .notEmpty()
    .withMessage('Relationship to patient is required')
    .isIn(['self', 'spouse', 'child', 'parent', 'other'])
    .withMessage('Relationship to patient must be one of: self, spouse, child, parent, other'),
  body('insuranceType')
    .isIn(['primary', 'secondary', 'tertiary'])
    .withMessage('Insurance type must be one of: primary, secondary, tertiary'),
  body('effectiveDate')
    .notEmpty()
    .withMessage('Effective date is required')
    .isISO8601()
    .withMessage('Effective date must be a valid date'),
  body('expirationDate')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid date')
    .custom((value, { req }) => {
      if (value && req.body.effectiveDate) {
        const effectiveDate = new Date(req.body.effectiveDate);
        const expirationDate = new Date(value);
        if (expirationDate <= effectiveDate) {
          throw new Error('Expiration date must be after effective date');
        }
      }
      return true;
    }),
  body('copayAmount')
    .optional()
    .custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
          throw new Error('Copay amount must be a positive number');
        }
        if (num > 10000) {
          throw new Error('Copay amount must not exceed $10,000');
        }
        // Check decimal places
        const parts = value.toString().split('.');
        if (parts.length > 1 && parts[1].length > 2) {
          throw new Error('Copay amount can have maximum 2 decimal places');
        }
      }
      return true;
    }),
  body('deductibleAmount')
    .optional()
    .custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
          throw new Error('Deductible amount must be a positive number');
        }
        if (num > 1000000) {
          throw new Error('Deductible amount must not exceed $1,000,000');
        }
        // Check decimal places
        const parts = value.toString().split('.');
        if (parts.length > 1 && parts[1].length > 2) {
          throw new Error('Deductible amount can have maximum 2 decimal places');
        }
      }
      return true;
    }),
  body('autoVerify')
    .optional()
    .isBoolean()
    .withMessage('autoVerify must be a boolean'),
  body('verificationStatus')
    .optional()
    .isIn(['verified', 'pending', 'failed'])
    .withMessage('Verification status must be one of: verified, pending, failed'),
  body('verificationDate')
    .optional()
    .isISO8601()
    .withMessage('Verification date must be a valid date'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
  body('deductiblesGrid')
    .optional()
    .isArray()
    .withMessage('deductiblesGrid must be an array'),
  body('coverageLimits')
    .optional()
    .isObject()
    .withMessage('coverageLimits must be an object'),
  body('coverageCategoryTable')
    .optional()
    .isArray()
    .withMessage('coverageCategoryTable must be an array'),
  body('coverageBookData')
    .optional()
    .isArray()
    .withMessage('coverageBookData must be an array'),
  body('planFeeGuide')
    .optional()
    .isString()
    .withMessage('planFeeGuide must be a string'),
  body('coverageType')
    .optional()
    .isString()
    .withMessage('coverageType must be a string'),
  body('subscriberSsn')
    .optional()
    .isString()
    .withMessage('subscriberSsn must be a string'),
  body('renewalMonth')
    .optional()
    .custom((value) => value === undefined || value === null || value === '' || !isNaN(Number(value)))
    .withMessage('renewalMonth must be a number'),
  body('assignmentOfBenefits')
    .optional()
    .isString()
    .withMessage('assignmentOfBenefits must be a string'),
  body('honorWriteOff')
    .optional()
    .isBoolean()
    .withMessage('honorWriteOff must be a boolean'),
  body('providersPlanFeeGuides')
    .optional()
    .isArray()
    .withMessage('providersPlanFeeGuides must be an array'),
  body('policyNotes')
    .optional()
    .isString()
    .withMessage('policyNotes must be a string'),
  body('eligibilityPolicyNotes')
    .optional()
    .isString()
    .withMessage('eligibilityPolicyNotes must be a string'),
  body('insurancePlanNotes')
    .optional()
    .isString()
    .withMessage('insurancePlanNotes must be a string'),
  body('healthPlan')
    .optional(),
  body('paymentPlan')
    .optional(),
];

export const updatePatientInsuranceValidator: ValidationChain[] = [
  body('insuranceCompanyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid insurance company ID format'),
  body('policyNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Policy number must be less than 50 characters'),
  body('groupNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Group number must be less than 50 characters'),
  body('groupName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Group name must be less than 100 characters'),
  body('subscriberName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Subscriber name must be less than 100 characters'),
  body('subscriberDateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Subscriber date of birth must be a valid date')
    .custom((value) => {
      if (!value) return true; // Optional field
      const dob = new Date(value);
      const today = new Date();
      if (dob > today) {
        throw new Error('Date of birth must be in the past');
      }
      // Calculate age accurately considering month and day
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age >= 120) {
        throw new Error('Subscriber age must be less than 120 years');
      }
      return true;
    }),
  body('relationshipToPatient')
    .optional()
    .isIn(['self', 'spouse', 'child', 'parent', 'other'])
    .withMessage('Relationship to patient must be one of: self, spouse, child, parent, other'),
  body('insuranceType')
    .optional()
    .isIn(['primary', 'secondary', 'tertiary'])
    .withMessage('Insurance type must be one of: primary, secondary, tertiary'),
  body('effectiveDate')
    .optional()
    .isISO8601()
    .withMessage('Effective date must be a valid date'),
  body('expirationDate')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid date'),
  body('copayAmount')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Copay amount must be between $0 and $10,000'),
  body('deductibleAmount')
    .optional()
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Deductible amount must be between $0 and $1,000,000'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('autoVerify')
    .optional()
    .isBoolean()
    .withMessage('autoVerify must be a boolean'),
  body('verificationStatus')
    .optional()
    .isIn(['verified', 'pending', 'failed'])
    .withMessage('Verification status must be one of: verified, pending, failed'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
  body('deductiblesGrid')
    .optional()
    .isArray()
    .withMessage('deductiblesGrid must be an array'),
  body('coverageLimits')
    .optional()
    .isObject()
    .withMessage('coverageLimits must be an object'),
  body('coverageCategoryTable')
    .optional()
    .isArray()
    .withMessage('coverageCategoryTable must be an array'),
  body('coverageBookData')
    .optional()
    .isArray()
    .withMessage('coverageBookData must be an array'),
  body('planFeeGuide')
    .optional()
    .isString()
    .withMessage('planFeeGuide must be a string'),
  body('coverageType')
    .optional()
    .isString()
    .withMessage('coverageType must be a string'),
  body('subscriberSsn')
    .optional()
    .isString()
    .withMessage('subscriberSsn must be a string'),
  body('renewalMonth')
    .optional()
    .custom((value) => value === undefined || value === null || value === '' || !isNaN(Number(value)))
    .withMessage('renewalMonth must be a number'),
  body('assignmentOfBenefits')
    .optional()
    .isString()
    .withMessage('assignmentOfBenefits must be a string'),
  body('honorWriteOff')
    .optional()
    .isBoolean()
    .withMessage('honorWriteOff must be a boolean'),
  body('providersPlanFeeGuides')
    .optional()
    .isArray()
    .withMessage('providersPlanFeeGuides must be an array'),
  body('policyNotes')
    .optional()
    .isString()
    .withMessage('policyNotes must be a string'),
  body('eligibilityPolicyNotes')
    .optional()
    .isString()
    .withMessage('eligibilityPolicyNotes must be a string'),
  body('insurancePlanNotes')
    .optional()
    .isString()
    .withMessage('insurancePlanNotes must be a string'),
  body('healthPlan')
    .optional(),
  body('paymentPlan')
    .optional(),
];

export const allergyIdValidator: ValidationChain[] = [
  param('allergyId')
    .notEmpty()
    .withMessage('Allergy ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid allergy ID format'),
];

export const createAllergyValidator: ValidationChain[] = [
  body('allergen')
    .trim()
    .notEmpty()
    .withMessage('Allergen is required')
    .isLength({ max: 100 })
    .withMessage('Allergen must be less than 100 characters'),
  body('reaction')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reaction must be less than 200 characters'),
  body('severity')
    .optional()
    .isIn(['mild', 'moderate', 'severe', 'unknown'])
    .withMessage('Severity must be one of: mild, moderate, severe, unknown'),
];

export const updateAllergyValidator: ValidationChain[] = [
  body('allergen')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Allergen must be less than 100 characters'),
  body('reaction')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reaction must be less than 200 characters'),
  body('severity')
    .optional()
    .isIn(['mild', 'moderate', 'severe', 'unknown'])
    .withMessage('Severity must be one of: mild, moderate, severe, unknown'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

