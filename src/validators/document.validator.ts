import { body, param, query } from 'express-validator';

const allowedDocumentTypes = [
  'insurance_card',
  'id',
  'lab_result',
  'imaging',
  'consent_form',
  'treatment_plan',
  'referral',
  'prescription',
  'preauth_attachment',
  'other',
];

export const documentIdValidator = [
  param('documentId')
    .isString()
    .notEmpty()
    .withMessage('Document ID is required'),
];

export const patientIdParamValidator = [
  param('patientId')
    .isString()
    .notEmpty()
    .withMessage('Patient ID is required'),
];

export const appointmentIdParamValidator = [
  param('appointmentId')
    .isString()
    .notEmpty()
    .withMessage('Appointment ID is required'),
];

export const authorizationIdParamValidator = [
  param('authorizationId')
    .isString()
    .notEmpty()
    .withMessage('Authorization ID is required'),
];

export const documentQueryValidator = [
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
    .isString(),
  query('appointmentId')
    .optional()
    .isString(),
  query('authorizationId')
    .optional()
    .isString(),
  query('documentType')
    .optional()
    .isIn(allowedDocumentTypes)
    .withMessage('Invalid document type'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
];

export const paginationQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('documentType')
    .optional()
    .isIn(allowedDocumentTypes)
    .withMessage('Invalid document type'),
];

export const createDocumentValidator = [
  body('patientId')
    .isString()
    .notEmpty()
    .withMessage('Patient ID is required'),
  body('appointmentId')
    .optional()
    .isString(),
  body('authorizationId')
    .optional()
    .isString(),
  body('documentName')
    .isString()
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Document name must be between 1 and 255 characters'),
  body('documentType')
    .isIn(allowedDocumentTypes)
    .withMessage('Invalid document type'),
  body('storagePath')
    .optional()
    .isString(),
  body('fileSizeInBytes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('File size must be a positive number'),
  body('mimeType')
    .optional()
    .isString()
    .trim(),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('isConfidential')
    .optional()
    .isBoolean()
    .withMessage('isConfidential must be a boolean'),
  body('expirationDate')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid date'),
  body('ocrText')
    .optional()
    .isString(),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .trim(),
];

export const updateDocumentValidator = [
  body('documentName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Document name must be between 1 and 255 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('isConfidential')
    .optional()
    .isBoolean()
    .withMessage('isConfidential must be a boolean'),
  body('expirationDate')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid date'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .trim(),
];

export const attachToNoteValidator = [
  body('clinicalNoteId')
    .isString()
    .notEmpty()
    .withMessage('Clinical note ID is required'),
];
