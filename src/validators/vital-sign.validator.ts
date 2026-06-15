import { body, param, query, ValidationChain } from 'express-validator';

export const vitalSignIdValidator: ValidationChain[] = [
  param('vitalSignId')
    .notEmpty()
    .withMessage('Vital sign ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid vital sign ID format'),
];

export const patientIdParamValidator: ValidationChain[] = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
];

export const appointmentIdParamValidator: ValidationChain[] = [
  param('appointmentId')
  .optional(),
];

export const createVitalSignValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('appointmentId')
    .optional(),
  body('bloodPressureSystolic')
    .optional()
    .isInt({ min: 50, max: 300 })
    .withMessage('Systolic blood pressure must be between 50 and 300 mmHg'),
  body('bloodPressureDiastolic')
    .optional()
    .isInt({ min: 30, max: 200 })
    .withMessage('Diastolic blood pressure must be between 30 and 200 mmHg'),
  body('temperature')
    .optional()
    .isFloat({ min: 90, max: 110 })
    .withMessage('Temperature must be between 90 and 110°F'),
  body('weight')
    .optional()
    .isFloat({ min: 1, max: 1500 })
    .withMessage('Weight must be between 1 and 1500 lbs'),
  body('height')
    .optional()
    .isFloat({ min: 10, max: 120 })
    .withMessage('Height must be between 10 and 120 inches'),
  body('heartRate')
    .optional()
    .isInt({ min: 20, max: 300 })
    .withMessage('Heart rate must be between 20 and 300 bpm'),
  body('respiratoryRate')
    .optional()
    .isInt({ min: 5, max: 60 })
    .withMessage('Respiratory rate must be between 5 and 60 breaths/min'),
  body('oxygenSaturation')
    .optional()
    .isFloat({ min: 50, max: 100 })
    .withMessage('Oxygen saturation must be between 50 and 100%'),
  body('recordedDate')
    .notEmpty()
    .withMessage('Recorded date is required')
    .isISO8601()
    .withMessage('Recorded date must be a valid date'),
  body('recordedTime')
    .notEmpty()
    .withMessage('Recorded time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Recorded time must be in HH:MM format'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

export const updateVitalSignValidator: ValidationChain[] = [
  body('bloodPressureSystolic')
    .optional()
    .isInt({ min: 50, max: 300 })
    .withMessage('Systolic blood pressure must be between 50 and 300 mmHg'),
  body('bloodPressureDiastolic')
    .optional()
    .isInt({ min: 30, max: 200 })
    .withMessage('Diastolic blood pressure must be between 30 and 200 mmHg'),
  body('temperature')
    .optional()
    .isFloat({ min: 90, max: 110 })
    .withMessage('Temperature must be between 90 and 110°F'),
  body('weight')
    .optional()
    .isFloat({ min: 1, max: 1500 })
    .withMessage('Weight must be between 1 and 1500 lbs'),
  body('height')
    .optional()
    .isFloat({ min: 10, max: 120 })
    .withMessage('Height must be between 10 and 120 inches'),
  body('heartRate')
    .optional()
    .isInt({ min: 20, max: 300 })
    .withMessage('Heart rate must be between 20 and 300 bpm'),
  body('respiratoryRate')
    .optional()
    .isInt({ min: 5, max: 60 })
    .withMessage('Respiratory rate must be between 5 and 60 breaths/min'),
  body('oxygenSaturation')
    .optional()
    .isFloat({ min: 50, max: 100 })
    .withMessage('Oxygen saturation must be between 50 and 100%'),
  body('recordedDate')
    .optional()
    .isISO8601()
    .withMessage('Recorded date must be a valid date'),
  body('recordedTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Recorded time must be in HH:MM format'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

export const vitalSignQueryValidator: ValidationChain[] = [
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
  query('appointmentId')
    .optional(),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
];

export const paginationQueryValidator: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

export const dateFilterQueryValidator: ValidationChain[] = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
];

export const vitalSignNormalRangesValidator: ValidationChain[] = [
  query('age')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Age must be a positive integer'),
  query('gender')
    .optional()
    .isString()
    .toLowerCase()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be one of: male, female, other'),
];

