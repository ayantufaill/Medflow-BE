import { body, param, query } from 'express-validator';

export const createLateFeePolicyValidator = [
  body('clinicId').isInt().withMessage('clinicId is required'),
  body('termsText').isString().notEmpty().withMessage('termsText is required'),
  body('gracePeriodDays').optional().isInt({ min: 0, max: 90 }).withMessage('gracePeriodDays must be 0-90'),
  body('paymentTermsDays').optional().isInt({ min: 1, max: 120 }).withMessage('paymentTermsDays must be 1-120'),
  body('feeType').isIn(['flat', 'percentage']).withMessage('feeType must be flat or percentage'),
  body('patientFeeAmount').optional().isFloat({ min: 0 }).withMessage('patientFeeAmount must be >= 0'),
  body('corporateFeePct').optional().isFloat({ min: 0, max: 100 }).withMessage('corporateFeePct must be 0-100'),
  body('capPct').optional().isFloat({ min: 0, max: 100 }).withMessage('capPct must be 0-100'),
];

export const updateLateFeePolicyValidator = [
  param('version').isInt().withMessage('version is required'),
  body('termsText').optional().isString().notEmpty().withMessage('termsText cannot be empty'),
  body('gracePeriodDays').optional().isInt({ min: 0, max: 90 }).withMessage('gracePeriodDays must be 0-90'),
  body('paymentTermsDays').optional().isInt({ min: 1, max: 120 }).withMessage('paymentTermsDays must be 1-120'),
  body('feeType').optional().isIn(['flat', 'percentage']).withMessage('feeType must be flat or percentage'),
  body('patientFeeAmount').optional().isFloat({ min: 0 }).withMessage('patientFeeAmount must be >= 0'),
  body('corporateFeePct').optional().isFloat({ min: 0, max: 100 }).withMessage('corporateFeePct must be 0-100'),
  body('capPct').optional().isFloat({ min: 0, max: 100 }).withMessage('capPct must be 0-100'),
  body('enabled').optional().isBoolean().withMessage('enabled must be boolean'),
];

export const recordAcceptanceValidator = [
  body('policyVersionId').isInt().withMessage('policyVersionId is required'),
  body('patientId').optional().isInt().withMessage('patientId must be integer'),
  body('corporateClientId').optional().isInt().withMessage('corporateClientId must be integer'),
  body('channel').isIn(['registration_form', 'signed_consent', 'portal_checkbox', 'verbal']).withMessage('Invalid channel'),
  body('acceptedBy').optional().isInt().withMessage('acceptedBy must be integer'),
];

export const waiveLateFeeValidator = [
  param('applicationId').isInt().withMessage('applicationId is required'),
  body('waivedAmount').isFloat({ min: 0.01 }).withMessage('waivedAmount must be > 0'),
  body('reasonCode').isIn(['HARDSHIP', 'GOODWILL', 'BILLING_ERROR', 'INSURANCE_DELAY', 'OTHER']).withMessage('Invalid reasonCode'),
  body('reasonNote').if(body('reasonCode').equals('OTHER')).notEmpty().withMessage('reasonNote required when reasonCode is OTHER'),
];

export const waiverReportValidator = [
  query('staffId').optional().isInt().withMessage('staffId must be integer'),
  query('from').optional().isISO8601().withMessage('from must be valid date'),
  query('to').optional().isISO8601().withMessage('to must be valid date'),
  query('reasonCode').optional().isIn(['HARDSHIP', 'GOODWILL', 'BILLING_ERROR', 'INSURANCE_DELAY', 'OTHER']).withMessage('Invalid reasonCode'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
];

export const policyTermsValidator = [
  param('version').isInt().withMessage('version is required'),
];

export const patientAcceptanceHistoryValidator = [
  param('patientId').isInt().withMessage('patientId is required'),
];