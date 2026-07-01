import { body, param, query, ValidationChain } from 'express-validator';

export const clinicalNoteIdValidator: ValidationChain[] = [
  param('clinicalNoteId')
    .notEmpty()
    .withMessage('Clinical note ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid clinical note ID format'),
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
    .notEmpty()
    .withMessage('Appointment ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid appointment ID format'),
];

export const providerIdParamValidator: ValidationChain[] = [
  param('providerId')
    .notEmpty()
    .withMessage('Provider ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
];

export const templateIdParamValidator: ValidationChain[] = [
  param('templateId')
    .notEmpty()
    .withMessage('Template ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid template ID format'),
];

export const createClinicalNoteValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('appointmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid appointment ID format'),
  body('providerId')
    .notEmpty()
    .withMessage('Provider ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
  body('templateId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid template ID format'),
  body('noteType')
    .optional()
    .isIn(['soap', 'progress', 'consultation', 'treatment_plan', 'other'])
    .withMessage('Invalid note type'),
  body('chiefComplaint')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Chief complaint must be less than 500 characters'),
  body('subjective')
    .optional()
    .isString()
    .withMessage('Subjective must be a string'),
  body('objective')
    .optional()
    .isString()
    .withMessage('Objective must be a string'),
  body('assessment')
    .optional()
    .isString()
    .withMessage('Assessment must be a string'),
  body('plan')
    .optional()
    .isString()
    .withMessage('Plan must be a string'),
  body('diagnosisCodes')
    .optional()
    .isArray()
    .withMessage('Diagnosis codes must be an array'),
  body('diagnosisCodes.*')
    .optional()
    .isString()
    .withMessage('Each diagnosis code must be a string'),
  body('structuredData')
    .optional()
    .custom((value) => {
      if (value !== undefined && typeof value !== 'object') {
        throw new Error('Structured data must be a valid object');
      }
      return true;
    }),
  body('historyOfPresentIllness')
    .optional()
    .isString()
    .withMessage('History of present illness must be a string'),
  body('physicalExam')
    .optional()
    .isString()
    .withMessage('Physical exam must be a string'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  body('attachments.*')
    .optional()
    .isString()
    .withMessage('Each attachment must be a string URL'),
  body('requiresFollowUp')
    .optional()
    .isBoolean()
    .withMessage('requiresFollowUp must be a boolean'),
  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Follow up date must be a valid date'),
];

export const updateClinicalNoteValidator: ValidationChain[] = [
  body('chiefComplaint')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Chief complaint must be less than 500 characters'),
  body('subjective')
    .optional()
    .isString()
    .withMessage('Subjective must be a string'),
  body('objective')
    .optional()
    .isString()
    .withMessage('Objective must be a string'),
  body('assessment')
    .optional()
    .isString()
    .withMessage('Assessment must be a string'),
  body('plan')
    .optional()
    .isString()
    .withMessage('Plan must be a string'),
  body('diagnosisCodes')
    .optional()
    .isArray()
    .withMessage('Diagnosis codes must be an array'),
  body('diagnosisCodes.*')
    .optional()
    .isString()
    .withMessage('Each diagnosis code must be a string'),
  body('structuredData')
    .optional()
    .custom((value) => {
      if (value !== undefined && typeof value !== 'object') {
        throw new Error('Structured data must be a valid object');
      }
      return true;
    }),
  body('historyOfPresentIllness')
    .optional()
    .isString()
    .withMessage('History of present illness must be a string'),
  body('physicalExam')
    .optional()
    .isString()
    .withMessage('Physical exam must be a string'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  body('attachments.*')
    .optional()
    .isString()
    .withMessage('Each attachment must be a string URL'),
  body('requiresFollowUp')
    .optional()
    .isBoolean()
    .withMessage('requiresFollowUp must be a boolean'),
  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Follow up date must be a valid date'),
];

export const saveDraftValidator: ValidationChain[] = [
  body('chiefComplaint')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Chief complaint must be less than 500 characters'),
  body('subjective')
    .optional()
    .isString()
    .withMessage('Subjective must be a string'),
  body('objective')
    .optional()
    .isString()
    .withMessage('Objective must be a string'),
  body('assessment')
    .optional()
    .isString()
    .withMessage('Assessment must be a string'),
  body('plan')
    .optional()
    .isString()
    .withMessage('Plan must be a string'),
  body('diagnosisCodes')
    .optional()
    .isArray()
    .withMessage('Diagnosis codes must be an array'),
  body('structuredData')
    .optional()
    .custom((value) => {
      if (value !== undefined && typeof value !== 'object') {
        throw new Error('Structured data must be a valid object');
      }
      return true;
    }),
  body('historyOfPresentIllness')
    .optional()
    .isString()
    .withMessage('History of present illness must be a string'),
  body('physicalExam')
    .optional()
    .isString()
    .withMessage('Physical exam must be a string'),
];

export const createFromTemplateValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('appointmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid appointment ID format'),
  body('providerId')
    .notEmpty()
    .withMessage('Provider ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
];

export const attachmentValidator: ValidationChain[] = [
  body('attachmentUrl')
    .notEmpty()
    .withMessage('Attachment URL is required')
    .isString()
    .withMessage('Attachment URL must be a string'),
];

export const clinicalNoteQueryValidator: ValidationChain[] = [
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
  query('providerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
  query('appointmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid appointment ID format'),
  query('noteType')
    .optional()
    .isIn(['soap', 'progress', 'consultation', 'treatment_plan', 'other'])
    .withMessage('Invalid note type'),
  query('isSigned')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isSigned must be either true or false'),
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
