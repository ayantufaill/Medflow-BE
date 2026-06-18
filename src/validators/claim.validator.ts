import { body, param, query, type ValidationChain } from 'express-validator';

const claimStatusValues = [
  'draft',
  'submitted',
  'pending',
  'paid',
  'partial',
  'partially_paid',
  'accepted',
  'denied',
  'rejected',
  'cancelled',
];

export const claimIdValidator: ValidationChain[] = [
  param('claimId').isString().notEmpty().withMessage('claimId is required'),
];

export const invoiceIdParamValidator: ValidationChain[] = [
  param('invoiceId').isString().notEmpty().withMessage('invoiceId is required'),
];

export const claimDocumentIdValidator: ValidationChain[] = [
  param('documentId').isString().notEmpty().withMessage('documentId is required'),
];

export const claimSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
  query('search').optional().isString().withMessage('search must be a string'),
  query('status').optional().isIn(claimStatusValues).withMessage('Invalid status value'),
  query('patientId').optional().isString().withMessage('patientId must be a string'),
  query('invoiceId').optional().isString().withMessage('invoiceId must be a string'),
  query('insuranceCompanyId').optional().isString().withMessage('insuranceCompanyId must be a string'),
  query('insuranceType').optional().isString().withMessage('insuranceType must be a string'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
  query('deniedOnly').optional().isBoolean().withMessage('deniedOnly must be true or false'),
];

export const createClaimFromInvoiceValidator: ValidationChain[] = [
  body('insuranceCompanyId').optional().isString().withMessage('insuranceCompanyId must be a string'),
  body('insuranceType').optional().isString().withMessage('insuranceType must be a string'),
  body('claimAmount').optional().isFloat({ min: 0 }).withMessage('claimAmount must be >= 0'),
  body('submittedAmount').optional().isFloat({ min: 0 }).withMessage('submittedAmount must be >= 0'),
  body('policyNumber').optional().isString().withMessage('policyNumber must be a string'),
  body('notes').optional().isString().isLength({ max: 2000 }).withMessage('notes must be less than 2000 characters'),
];

export const updateClaimValidator: ValidationChain[] = [
  body('insuranceCompanyId').optional().isString().withMessage('insuranceCompanyId must be a string'),
  body('invoiceId').optional().isString().withMessage('invoiceId must be a string'),
  body('insuranceType').optional().isString().withMessage('insuranceType must be a string'),
  body('status').optional().isIn(claimStatusValues).withMessage('Invalid status value'),
  body('claimAmount').optional().isFloat({ min: 0 }).withMessage('claimAmount must be >= 0'),
  body('submittedAmount').optional().isFloat({ min: 0 }).withMessage('submittedAmount must be >= 0'),
  body('totalAmount').optional().isFloat({ min: 0 }).withMessage('totalAmount must be >= 0'),
  body('paidAmount').optional().isFloat({ min: 0 }).withMessage('paidAmount must be >= 0'),
  body('patientResponsibility').optional().isFloat({ min: 0 }).withMessage('patientResponsibility must be >= 0'),
  body('policyNumber').optional().isString().withMessage('policyNumber must be a string'),
  body('notes').optional().isString().isLength({ max: 2000 }).withMessage('notes must be less than 2000 characters'),
  body('submissionDate').optional().isISO8601().withMessage('submissionDate must be a valid date'),
  body('deniedDate').optional({ nullable: true }).isISO8601().withMessage('deniedDate must be a valid date'),
  body('denialReason').optional({ nullable: true }).isString().withMessage('denialReason must be a string'),
  body('paidDate').optional().isISO8601().withMessage('paidDate must be a valid date'),
];

export const resubmitClaimValidator: ValidationChain[] = [
  body('workflowType').optional().isIn(['correction', 'appeal']).withMessage('Invalid workflow type'),
  body('correctionNotes').optional().isString().withMessage('correctionNotes must be a string'),
  body('appealReason').optional().isString().withMessage('appealReason must be a string'),
  body('correctedFields').optional().isObject().withMessage('correctedFields must be an object'),
];

export const batchSubmitValidator: ValidationChain[] = [
  body('claimIds').isArray({ min: 1 }).withMessage('claimIds must be a non-empty array of strings'),
  body('claimIds.*').isString().notEmpty().withMessage('Each claimId must be a string'),
  body('submissionType').optional().isString().withMessage('submissionType must be a string'),
];

export const recordBatchPaymentValidator: ValidationChain[] = [
  body('paymentRef').isString().notEmpty().withMessage('paymentRef is required'),
  body('carrierId').isString().notEmpty().withMessage('carrierId is required'),
  body('paymentDate').isISO8601().withMessage('paymentDate must be a valid date'),
  body('checkAmount').isFloat({ min: 0 }).withMessage('checkAmount must be >= 0'),
  body('allocations').isArray({ min: 1 }).withMessage('allocations must be a non-empty array'),
  body('allocations.*.claimId').isString().notEmpty().withMessage('allocations claimId is required'),
  body('allocations.*.paidAmount').isFloat({ min: 0 }).withMessage('allocations paidAmount must be >= 0'),
  body('allocations.*.writeOff').isFloat({ min: 0 }).withMessage('allocations writeOff must be >= 0'),
];

export const batchInvoicesValidator: ValidationChain[] = [
  body('patientIds').isArray({ min: 1 }).withMessage('patientIds must be a non-empty array of strings'),
  body('patientIds.*').isString().notEmpty().withMessage('Each patientId must be a string'),
  body('deliveryPreference').optional().isString().withMessage('deliveryPreference must be a string'),
];

export const quickStatusUpdateValidator: ValidationChain[] = [
  body('status').isIn(claimStatusValues).withMessage('Invalid status value'),
  body('note').optional().isString().withMessage('note must be a string'),
];

export const paymentIdParamValidator: ValidationChain[] = [
  param('paymentId').isString().notEmpty().withMessage('paymentId is required'),
];

export const uncompleteProceduresValidator: ValidationChain[] = [
  body('procedureIds').isArray({ min: 1 }).withMessage('procedureIds must be a non-empty array of strings'),
  body('procedureIds.*').isString().notEmpty().withMessage('Each procedureId must be a string'),
];

export const createManualClaimValidator: ValidationChain[] = [
  body('patientId')
    .isString()
    .notEmpty()
    .withMessage('patientId is required')
    .matches(/^\d+$/)
    .withMessage('Invalid patient ID'),

  body('insuranceId')
    .isString()
    .notEmpty()
    .withMessage('insuranceId is required')
    .matches(/^\d+$/)
    .withMessage('Invalid insurance ID'),

  body('treatingProviderId')
    .isString()
    .notEmpty()
    .withMessage('treatingProviderId is required')
    .matches(/^\d+$/)
    .withMessage('Invalid treating provider ID'),

  body('billingEntityId')
    .isString()
    .notEmpty()
    .withMessage('billingEntityId is required')
    .matches(/^\d+$/)
    .withMessage('Invalid billing entity ID'),

  body('claimType')
    .optional()
    .isIn(['Manual', 'Electronic'])
    .withMessage('claimType must be either Manual or Electronic')
    .default('Manual'),

  body('description')
    .optional()
    .isString()
    .withMessage('description must be a string'),

  body('note')
    .optional()
    .isString()
    .withMessage('note must be a string'),

  body('selectedItems')
    .isArray({ min: 1 })
    .withMessage('selectedItems must be a non-empty array'),

  body('selectedItems.*.invoiceId')
    .isString()
    .notEmpty()
    .withMessage('invoiceId is required')
    .matches(/^\d+$/)
    .withMessage('Invalid invoice ID'),

  body('selectedItems.*.itemId')
    .isString()
    .notEmpty()
    .withMessage('itemId is required')
    .matches(/^\d+$/)
    .withMessage('Invalid item ID'),

  body('selectedItems.*.amount')
    .isNumeric()
    .withMessage('amount must be a number')
    .custom((value) => value > 0)
    .withMessage('amount must be greater than 0'),
];

