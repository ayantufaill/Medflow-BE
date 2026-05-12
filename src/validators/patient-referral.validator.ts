import { body, query } from 'express-validator';

export const getPatientReferralsValidator = [
  query('patientId').optional().isString().withMessage('patientId must be a string'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 }),
];

export const createPatientReferralValidator = [
  body('patientId').notEmpty().withMessage('patientId is required'),
  body('specialist').notEmpty().withMessage('specialist is required'),
  body('specialty').notEmpty().withMessage('specialty is required'),
  body('reason').notEmpty().withMessage('reason is required'),
];
