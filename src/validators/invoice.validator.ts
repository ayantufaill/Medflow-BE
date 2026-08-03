import { body, param, query, type ValidationChain } from 'express-validator';

export const invoiceIdValidator: ValidationChain[] = [
  param('invoiceId')
    .notEmpty()
    .withMessage('Invoice ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid invoice ID format'),
];

export const invoiceItemIdValidator: ValidationChain[] = [
  param('itemId')
    .notEmpty()
    .withMessage('Invoice item ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid invoice item ID format'),
];

export const appointmentIdParamValidator: ValidationChain[] = [
  param('appointmentId')
    .notEmpty()
    .withMessage('Appointment ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid appointment ID format'),
];

export const patientIdParamValidator: ValidationChain[] = [
  param('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
];

export const invoiceSearchValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('patientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  query('appointmentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid appointment ID format'),
  query('providerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
  query('insuranceCompanyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid insurance company ID format'),
  query('status')
    .optional()
    .isIn(['draft', 'pending', 'submitted', 'partially_paid', 'paid', 'denied', 'void'])
    .withMessage('Invalid status value'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
  query('search').optional().isString().withMessage('search must be a string'),
];

export const createInvoiceFromAppointmentValidator: ValidationChain[] = [
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('insuranceCompanyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid insurance company ID format'),
  body('providerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  body('copayAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Copay amount must be a positive number'),
];

export const updateInvoiceValidator: ValidationChain[] = [
  body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
  body('insuranceCompanyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid insurance company ID format'),
  body('providerId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid provider ID format'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  body('discountAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount must be a positive number'),
  body('copayAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Copay amount must be a positive number'),
  body('status')
    .optional()
    .isIn(['draft', 'pending', 'submitted', 'partially_paid', 'paid', 'denied', 'void'])
    .withMessage('Invalid status value'),
  body('insuranceCoveragePercent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Insurance coverage percent must be between 0 and 100'),
  body('insurancePortion')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Insurance portion must be a positive number'),
  body('patientPortion')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Patient portion must be a positive number'),
];

export const createInvoiceItemValidator: ValidationChain[] = [
  body('serviceId')
    .optional() // Optional - allows manual line items without a service
    .isInt({ min: 1 })
    .withMessage('Invalid service ID format'),
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('unitPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),
  body('description')
    .notEmpty()
    .withMessage('Description is required when no service ID is provided')
    .isString()
    .withMessage('Description must be a string'),
  body('cptCode')
    .optional()
    .isLength({ min: 4, max: 10 })
    .withMessage('CPT code must be between 4 and 10 characters'),
];

export const updateInvoiceItemValidator: ValidationChain[] = [
  body('serviceId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid service ID format'),
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('unitPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('cptCode')
    .optional()
    .isLength({ min: 4, max: 10 })
    .withMessage('CPT code must be between 4 and 10 characters'),
  body('insPortion')
    .optional()
    .isNumeric()
    .withMessage('insPortion must be numeric'),
  body('ptPortion')
    .optional()
    .isNumeric()
    .withMessage('ptPortion must be numeric'),
  body('writeoff')
    .optional()
    .isNumeric()
    .withMessage('writeoff must be numeric'),
];

export const recalculateInvoiceValidator: ValidationChain[] = [
  body('insuranceCoveragePercent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Insurance coverage percent must be between 0 and 100'),
];

export const voidInvoiceValidator: ValidationChain[] = [
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('reason must be less than 500 characters'),
];

export const createStandaloneInvoiceValidator: ValidationChain[] = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid patient ID format'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items must be a non-empty array'),
  body('items.*.code')
    .notEmpty()
    .withMessage('Item code is required'),
  body('items.*.description')
    .notEmpty()
    .withMessage('Item description is required'),
  body('items.*.date')
    .optional()
    .isISO8601()
    .withMessage('Item date must be a valid ISO8601 date'),
  body('items.*.site')
    .optional()
    .isString(),
  body('items.*.provider')
    .optional()
    .isString(),
  body('items.*.writeoff')
    .optional()
    .isNumeric(),
  body('items.*.ptPortion')
    .optional()
    .isNumeric(),
  body('items.*.insPortion')
    .optional()
    .isNumeric(),
  body('items.*.charge')
    .optional()
    .isNumeric(),
  body('items.*.balance')
    .optional()
    .isNumeric(),
  body('items.*.dbi')
    .optional()
    .isBoolean(),
  body('items.*.completed')
    .optional()
    .isBoolean(),
];
