import { body, param, query, ValidationChain } from 'express-validator';

const isNumericIdString = (value: unknown): boolean =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

const optionalNumericIdValidator = (field: string, message: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .custom((value) => isNumericIdString(value))
    .withMessage(message);

export const patientIdValidator: ValidationChain[] = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .custom((value) => isNumericIdString(value))
    .withMessage('Invalid patient ID format'),
];

export const patientRequestIdValidator: ValidationChain[] = [
  param('requestId')
    .notEmpty()
    .withMessage('Request ID is required')
    .isString()
    .withMessage('Invalid request ID format'),
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
  body('title')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Title must be less than 20 characters'),
  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'])
    .withMessage('Gender must be one of: male, female, non_binary, prefer_not_to_say, unknown'),
  body('sexAtBirth')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'])
    .withMessage('sexAtBirth must be one of: male, female, non_binary, prefer_not_to_say, unknown'),
  body('genderIdentity')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'])
    .withMessage('genderIdentity must be one of: male, female, non_binary, prefer_not_to_say, unknown'),
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
  body('portalAccessEnabled')
    .optional()
    .isBoolean()
    .withMessage('portalAccessEnabled must be a boolean'),
  body('maritalStatus')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('maritalStatus must be less than 50 characters'),
  body('occupation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('occupation must be less than 100 characters'),
  body('employer')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('employer must be less than 100 characters'),
  body('guardianEmployer')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('guardianEmployer must be less than 100 characters'),
  body('patientProfileType')
    .optional()
    .isIn(['adult', 'pediatric'])
    .withMessage('patientProfileType must be one of: adult, pediatric'),
  body('workAddress')
    .optional()
    .isObject()
    .withMessage('workAddress must be an object'),
  body('workAddress.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('workAddress.country must be less than 100 characters'),
  body('workAddress.line1')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('workAddress.line1 must be less than 100 characters'),
  body('workAddress.line2')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('workAddress.line2 must be less than 100 characters'),
  body('workAddress.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('workAddress.city must be less than 50 characters'),
  body('workAddress.state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('workAddress.state must be less than 50 characters'),
  body('workAddress.postalCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('workAddress.postalCode must be less than 20 characters'),
  optionalNumericIdValidator('userAccountId', 'Invalid user account ID format'),
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
  body('customFields')
    .optional()
    .isObject()
    .withMessage('customFields must be an object'),
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
  body('title')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Title must be less than 20 characters'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'])
    .withMessage('Gender must be one of: male, female, non_binary, prefer_not_to_say, unknown'),
  body('sexAtBirth')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'])
    .withMessage('sexAtBirth must be one of: male, female, non_binary, prefer_not_to_say, unknown'),
  body('genderIdentity')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'])
    .withMessage('genderIdentity must be one of: male, female, non_binary, prefer_not_to_say, unknown'),
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
  body('maritalStatus')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('maritalStatus must be less than 50 characters'),
  body('occupation')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('occupation must be less than 100 characters'),
  body('employer')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('employer must be less than 100 characters'),
  body('guardianEmployer')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('guardianEmployer must be less than 100 characters'),
  body('patientProfileType')
    .optional()
    .isIn(['adult', 'pediatric'])
    .withMessage('patientProfileType must be one of: adult, pediatric'),
  body('workAddress')
    .optional()
    .isObject()
    .withMessage('workAddress must be an object'),
  body('workAddress.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('workAddress.country must be less than 100 characters'),
  body('workAddress.line1')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('workAddress.line1 must be less than 100 characters'),
  body('workAddress.line2')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('workAddress.line2 must be less than 100 characters'),
  body('workAddress.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('workAddress.city must be less than 50 characters'),
  body('workAddress.state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('workAddress.state must be less than 50 characters'),
  body('workAddress.postalCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('workAddress.postalCode must be less than 20 characters'),
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
  body('customFields')
    .optional()
    .isObject()
    .withMessage('customFields must be an object'),
];

export const patientWorkspaceMetaValidator: ValidationChain[] = [
  body('sexAtBirth')
    .optional({ nullable: true })
    .isString()
    .withMessage('sexAtBirth must be a string'),
  body('genderIdentity')
    .optional({ nullable: true })
    .isString()
    .withMessage('genderIdentity must be a string'),
  body('maritalStatus')
    .optional({ nullable: true })
    .isString()
    .withMessage('maritalStatus must be a string'),
  body('occupation')
    .optional({ nullable: true })
    .isString()
    .withMessage('occupation must be a string'),
  body('employer')
    .optional({ nullable: true })
    .isString()
    .withMessage('employer must be a string'),
  body('guardianEmployer')
    .optional({ nullable: true })
    .isString()
    .withMessage('guardianEmployer must be a string'),
  body('workAddress')
    .optional({ nullable: true })
    .isObject()
    .withMessage('workAddress must be an object'),
  body('patientProfileType')
    .optional({ nullable: true })
    .isIn(['adult', 'pediatric'])
    .withMessage('patientProfileType must be one of: adult, pediatric'),
  body('preferredDentistId')
    .optional({ nullable: true })
    .isString()
    .withMessage('preferredDentistId must be a string'),
  body('preferredHygienistId')
    .optional({ nullable: true })
    .isString()
    .withMessage('preferredHygienistId must be a string'),
  body('headOfCommunication')
    .optional({ nullable: true })
    .isObject()
    .withMessage('headOfCommunication must be an object'),
  body('household')
    .optional()
    .isArray()
    .withMessage('household must be an array'),
  body('spouseInfo')
    .optional({ nullable: true })
    .isObject()
    .withMessage('spouseInfo must be an object'),
  body('patientFlags')
    .optional()
    .isArray()
    .withMessage('patientFlags must be an array'),
  body('financialResponsibility')
    .optional({ nullable: true })
    .isObject()
    .withMessage('financialResponsibility must be an object'),
  body('referralSource')
    .optional({ nullable: true })
    .isString()
    .withMessage('referralSource must be a string'),
];

export const createPatientUpdateRequestValidator: ValidationChain[] = [
  body('sections')
    .isArray({ min: 1 })
    .withMessage('sections must be a non-empty array'),
  body('sections.*')
    .isIn(['demographics', 'medical-history', 'dental-history', 'hipaa', 'consent', 'custom-form'])
    .withMessage('Invalid update request section'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('note must be less than 1000 characters'),
];

export const applyPatientReconciliationValidator: ValidationChain[] = [
  body('fields')
    .isObject()
    .withMessage('fields must be an object'),
];

export const patientCommunicationValidator: ValidationChain[] = [
  body('channel')
    .isIn(['text', 'email', 'call_note', 'review_request', 'welcome', 'portal_invite', 'quick_payment', 'update_request'])
    .withMessage('Invalid communication channel'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('message is required')
    .isLength({ max: 5000 })
    .withMessage('message must be less than 5000 characters'),
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('subject must be less than 255 characters'),
  body('appointmentId')
    .optional()
    .isString()
    .withMessage('appointmentId must be a string'),
];

export const patientMedicalHistoryValidator: ValidationChain[] = [
  body('generalInfo').optional().isObject().withMessage('generalInfo must be an object'),
  body('generalInfo.healthEstimate').optional().isString().withMessage('generalInfo.healthEstimate must be a string'),
  body('generalInfo.physicianName').optional().isString().withMessage('generalInfo.physicianName must be a string'),
  body('generalInfo.physicianSpecialty').optional().isString().withMessage('generalInfo.physicianSpecialty must be a string'),
  body('generalInfo.lastExamDate').optional({ values: 'falsy' }).isISO8601().withMessage('generalInfo.lastExamDate must be a valid date'),
  body('generalInfo.purpose').optional().isString().withMessage('generalInfo.purpose must be a string'),
  body('generalInfo.weight').optional().isString().withMessage('generalInfo.weight must be a string'),
  body('generalInfo.weightUnit').optional().isString().withMessage('generalInfo.weightUnit must be a string'),
  body('generalInfo.height').optional().isString().withMessage('generalInfo.height must be a string'),
  body('generalInfo.heightUnit').optional().isString().withMessage('generalInfo.heightUnit must be a string'),
  body('premed').optional().isObject().withMessage('premed must be an object'),
  body('premed.requiresPremed').optional().isBoolean().withMessage('premed.requiresPremed must be a boolean'),
  body('risk').optional().isObject().withMessage('risk must be an object'),
  body('risk.asaClass').optional().isString().withMessage('risk.asaClass must be a string'),
  body('risk.level').optional().isIn(['low', 'moderate', 'high']).withMessage('risk.level must be one of: low, moderate, high'),
  body('sections').optional().isArray().withMessage('sections must be an array'),
  body('sections.*.question').optional().isString().withMessage('section question must be a string'),
  body('sections.*.answer').optional().isString().withMessage('section answer must be a string'),
  body('sections.*.comment').optional().isString().withMessage('section comment must be a string'),
  body('sections.*.doctorNote').optional().isString().withMessage('section doctorNote must be a string'),
  body('sections.*.additionalInfo').optional().isArray().withMessage('section additionalInfo must be an array'),
  body('medications').optional().isArray().withMessage('medications must be an array'),
  body('medications.*.drug').optional().isString().withMessage('medication drug must be a string'),
  body('medications.*.dosage').optional().isString().withMessage('medication dosage must be a string'),
  body('medications.*.purpose').optional().isString().withMessage('medication purpose must be a string'),
  body('supplements').optional().isArray().withMessage('supplements must be an array'),
  body('supplements.*.drug').optional().isString().withMessage('supplement drug must be a string'),
  body('supplements.*.dosage').optional().isString().withMessage('supplement dosage must be a string'),
  body('supplements.*.purpose').optional().isString().withMessage('supplement purpose must be a string'),
  body('review').optional().isObject().withMessage('review must be an object'),
  body('review.reviewedWithPatient').optional().isBoolean().withMessage('review.reviewedWithPatient must be a boolean'),
  body('review.reviewedAt').optional({ values: 'falsy' }).isISO8601().withMessage('review.reviewedAt must be a valid date'),
  body('review.signatureUrl').optional({ values: 'falsy' }).isString().withMessage('review.signatureUrl must be a string'),
];

export const patientDentalHistoryValidator: ValidationChain[] = [
  body('generalInfo').optional().isObject().withMessage('generalInfo must be an object'),
  body('generalInfo.mouthCondition').optional().isString().withMessage('generalInfo.mouthCondition must be a string'),
  body('generalInfo.previousDentist').optional().isString().withMessage('generalInfo.previousDentist must be a string'),
  body('generalInfo.recentExamDate').optional({ values: 'falsy' }).isISO8601().withMessage('generalInfo.recentExamDate must be a valid date'),
  body('generalInfo.recentTreatmentDate').optional({ values: 'falsy' }).isISO8601().withMessage('generalInfo.recentTreatmentDate must be a valid date'),
  body('generalInfo.immediateConcern').optional().isString().withMessage('generalInfo.immediateConcern must be a string'),
  body('generalInfo.patientSince').optional().isString().withMessage('generalInfo.patientSince must be a string'),
  body('generalInfo.recentXrayDate').optional({ values: 'falsy' }).isISO8601().withMessage('generalInfo.recentXrayDate must be a valid date'),
  body('generalInfo.dentistVisitFrequency').optional().isString().withMessage('generalInfo.dentistVisitFrequency must be a string'),
  body('personalHistory').optional().isArray().withMessage('personalHistory must be an array'),
  body('personalHistory.*.question').optional().isString().withMessage('personalHistory question must be a string'),
  body('personalHistory.*.answer').optional().isString().withMessage('personalHistory answer must be a string'),
  body('personalHistory.*.scale').optional().isString().withMessage('personalHistory scale must be a string'),
  body('personalHistory.*.note').optional().isString().withMessage('personalHistory note must be a string'),
  body('personalHistory.*.additionalInfo').optional().isString().withMessage('personalHistory additionalInfo must be a string'),
  body('review').optional().isObject().withMessage('review must be an object'),
  body('review.reviewedWithPatient').optional().isBoolean().withMessage('review.reviewedWithPatient must be a boolean'),
  body('review.reviewedAt').optional({ values: 'falsy' }).isISO8601().withMessage('review.reviewedAt must be a valid date'),
  body('review.signatureDataUrl').optional({ values: 'falsy' }).isString().withMessage('review.signatureDataUrl must be a string'),
];

export const patientSearchValidator: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
  query('dobStart')
    .optional()
    .isISO8601()
    .withMessage('dobStart must be a valid ISO 8601 date'),
  query('dobEnd')
    .optional()
    .isISO8601()
    .withMessage('dobEnd must be a valid ISO 8601 date'),
];
