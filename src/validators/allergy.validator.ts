import { body, param, query, ValidationChain } from 'express-validator';

export const allergyIdValidator: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Allergy ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid allergy ID format'),
];

export const allergyIdParamValidator: ValidationChain[] = [
  param('allergyId')
    .notEmpty()
    .withMessage('Allergy ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid allergy ID format'),
];

export const createAllergyValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('allergen')
    .trim()
    .notEmpty()
    .withMessage('Allergen is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Allergen must be between 1 and 200 characters'),
  body('reaction')
    .trim()
    .notEmpty()
    .withMessage('Reaction is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Reaction must be between 1 and 500 characters'),
  body('severity')
    .notEmpty()
    .withMessage('Severity is required')
    .isIn(['mild', 'moderate', 'severe'])
    .withMessage('Severity must be one of: mild, moderate, severe'),
  body('documentedBy')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid documented_by format'),
  body('documentedDate')
    .notEmpty()
    .withMessage('Documented date is required')
    .isISO8601()
    .withMessage('Documented date must be a valid date')
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) {
        throw new Error('Documented date must not be a future date');
      }
      return true;
    }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

// Validator for patient routes where patientId comes from route param
export const createPatientAllergyValidator: ValidationChain[] = [
  body('allergen')
    .trim()
    .notEmpty()
    .withMessage('Allergen is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Allergen must be between 1 and 200 characters'),
  body('reaction')
    .trim()
    .notEmpty()
    .withMessage('Reaction is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Reaction must be between 1 and 500 characters'),
  body('severity')
    .notEmpty()
    .withMessage('Severity is required')
    .isIn(['mild', 'moderate', 'severe'])
    .withMessage('Severity must be one of: mild, moderate, severe'),
  body('documentedBy')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid documented_by format'),
  body('documentedDate')
    .notEmpty()
    .withMessage('Documented date is required')
    .isISO8601()
    .withMessage('Documented date must be a valid date')
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) {
        throw new Error('Documented date must not be a future date');
      }
      return true;
    }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const updateAllergyValidator: ValidationChain[] = [
  body('allergen')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Allergen cannot be empty')
    .isLength({ min: 1, max: 200 })
    .withMessage('Allergen must be between 1 and 200 characters'),
  body('reaction')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Reaction cannot be empty')
    .isLength({ min: 1, max: 500 })
    .withMessage('Reaction must be between 1 and 500 characters'),
  body('severity')
    .optional()
    .isIn(['mild', 'moderate', 'severe'])
    .withMessage('Severity must be one of: mild, moderate, severe'),
  body('documentedDate')
    .optional()
    .isISO8601()
    .withMessage('Documented date must be a valid date')
    .custom((value) => {
      if (value) {
        const date = new Date(value);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (date > today) {
          throw new Error('Documented date must not be a future date');
        }
      }
      return true;
    }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const getAllergiesQueryValidator: ValidationChain[] = [
  query('patient_id')
    .notEmpty()
    .withMessage('patient_id is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient_id format'),
];

