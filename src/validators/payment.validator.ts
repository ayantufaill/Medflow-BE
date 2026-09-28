import { body, param, query, type ValidationChain } from 'express-validator';

export const paymentIdValidator: ValidationChain[] = [
  param('paymentId')
    .notEmpty()
    .withMessage('Payment ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid payment ID format'),
];

export const patientIdParamValidator: ValidationChain[] = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
];

export const invoiceIdParamValidator: ValidationChain[] = [
  param('invoiceId')
    .notEmpty()
    .withMessage('Invoice ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid invoice ID format'),
];

export const paymentSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('search').optional().isString().withMessage('search must be a string'),
  query('patientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  query('invoiceId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid invoice ID format'),
  query('paymentMethod')
    .optional()
    .isIn(['cash', 'check', 'card', 'ach', 'insurance', 'payment_plan'])
    .withMessage('Invalid payment method'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
];

export const createPaymentValidator: ValidationChain[] = [
  body('invoiceId')
    .notEmpty()
    .withMessage('Invoice ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid invoice ID format'),
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('insuranceCompanyId')
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer((val) => {
      if (val && typeof val === 'object') {
        const id = val._id || val.id;
        return id ? String(id) : null;
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null' || !trimmed) {
          return null;
        }
        return trimmed;
      }
      return val;
    })
    .custom((val) => {
      if (val === null || val === undefined || val === '') return true;
      if (!/^\d+$/.test(String(val))) {
        throw new Error('Invalid insurance company ID format');
      }
      return true;
    }),
  body('amount')
    .exists({ checkNull: true })
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be 0 or greater'),
  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .custom((val) => {
      const norm = String(val || '').toLowerCase().trim();
      const allowed = ['cash', 'check', 'card', 'ach', 'insurance', 'payment_plan', 'account_credit', 'account credit', 'credit', 'patient credit'];
      if (!allowed.includes(norm)) {
        throw new Error('Invalid payment method');
      }
      return true;
    }),
  body('paymentSource')
    .optional()
    .isIn(['patient', 'insurance_company', 'other'])
    .withMessage('Invalid payment source'),
  body('paymentDate')
    .notEmpty()
    .withMessage('Payment date is required')
    .isISO8601()
    .withMessage('Payment date must be a valid date'),
  body('referenceNumber').optional().isString().withMessage('Reference number must be a string'),
  body('chequeNo').optional().isString().withMessage('Cheque number must be a string'),
  body('branchNo').optional().isString().withMessage('Branch number must be a string'),
  body('processorFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Processor fee must be a positive number'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  body('procedures').optional().isArray().withMessage('Procedures must be an array'),
  body('procedures.*.id').optional().isString().withMessage('Procedure ID must be a string'),
  body('procedures.*.procId').optional().isString().withMessage('Procedure ID must be a string'),
  body('procedures.*.procedureId').optional().isString().withMessage('Procedure ID must be a string'),
  body('procedures.*.allowed').optional().isNumeric().withMessage('Allowed fee must be a number'),
  body('procedures.*.wo').optional().isNumeric().withMessage('Writeoff must be a number'),
  body('procedures.*.pay').optional().isNumeric().withMessage('Pay amount must be a number'),
  body('procedures.*.ded').optional().isNumeric().withMessage('Deductible must be a number'),
  body('procedures.*.updateAllowedFee').optional().isBoolean().withMessage('updateAllowedFee must be a boolean'),
  body('procedures.*.updateInsFlatPortion').optional().isBoolean().withMessage('updateInsFlatPortion must be a boolean'),
  body('procedures.*.moveToNewClaim').optional().isBoolean().withMessage('moveToNewClaim must be a boolean'),
  body('procedures.*.claimId').optional().isString().withMessage('Claim ID must be a string'),
  body('isPartialPayment').optional().isBoolean().withMessage('isPartialPayment must be a boolean'),
  body('overpaymentAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('overpaymentAmount must be >= 0'),
  body('overpaymentAction')
    .optional()
    .isIn(['credit', 'refund'])
    .withMessage('overpaymentAction must be credit or refund'),
];

export const applyPaymentValidator: ValidationChain[] = [
  body('invoiceId')
    .notEmpty()
    .withMessage('Invoice ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid invoice ID format'),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
];

export const voidPaymentValidator: ValidationChain[] = [
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('reason must be less than 500 characters'),
];
