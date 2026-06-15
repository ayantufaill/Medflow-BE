import { param, body } from 'express-validator';

export const examTypeParamValidator = [
  param('examType')
    .isString()
    .isIn([
      'radiographic',
      'tmj',
      'head-neck',
      'tooth-structure',
      'morphological',
      'periodontal',
      'dentofacial',
      'airway',
      'biomechanical',
      'functional',
      'dentofacial-opinion',
      'periodontal-opinion',
    ])
    .withMessage('Invalid examType provided.'),
];

export const appointmentIdParamValidator = [
  param('appointmentId')
    .isInt({ min: 1 })
    .withMessage('appointmentId must be a valid integer.'),
];

export const upsertExamValidator = [
  body('patientId')
    .notEmpty()
    .withMessage('patientId is required.'),
  body('providerId')
    .notEmpty()
    .withMessage('providerId is required.'),
  body('examData')
    .isObject()
    .withMessage('examData must be an object.'),
];
