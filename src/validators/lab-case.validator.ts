import { param, body, query } from 'express-validator';

export const getLabCasesValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('patientId').optional().isString().withMessage('Patient ID must be a string'),
  query('status').optional().isString().isIn(['New', 'Sent', 'Received', 'Quality Checked', 'Completed', 'In Progress', 'All']).withMessage('Invalid status'),
  query('tab').optional().isString().isIn(['Active', 'Completed', 'Archived']).withMessage('Invalid tab'),
  query('sortBy').optional().isString().isIn(['dueDate', 'patient', 'status']).withMessage('Invalid sortBy'),
  query('order').optional().isString().isIn(['asc', 'desc', 'Ascending', 'Descending']).withMessage('Invalid order'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
];

// ✅ Updated: now enforces the ID must be an integer
export const labCaseIdValidator = [
  param('id')
    .notEmpty().withMessage('Lab case ID is required')
    .isInt().withMessage('ID must be an integer'), // added this line
];

export const createLabCaseValidator = [
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('laboratoryId').notEmpty().withMessage('Laboratory ID is required'),
  body('appointmentId').optional().isString().withMessage('Appointment ID must be a string'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
  body('instructions').optional().isString(),
  body('labFee').optional().isFloat({ min: 0 }).withMessage('Lab fee must be a non-negative number'),
  body('providerNum').optional().isString().withMessage('Provider Number must be a string'),
  body('sharedOn').optional().isISO8601().withMessage('Invalid shared date'),
];

export const updateLabCaseValidator = [
  body('laboratoryId').optional().isString(),
  body('appointmentId').optional().isString(),
  body('dueDate').optional().isISO8601(),
  body('dateSent').optional().isISO8601(),
  body('dateReceived').optional().isISO8601(),
  body('dateChecked').optional().isISO8601(),
  body('instructions').optional().isString(),
  body('labFee').optional().isFloat({ min: 0 }),
  body('invoiceNum').optional().isString(),
];

export const getLabsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('includeHidden').optional().isBoolean(),
];

export const createLabValidator = [
  body('description').notEmpty().withMessage('Lab name is required'),
  body('phone').optional().isString(),
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('address').optional().isString(),
  body('city').optional().isString(),
  body('state').optional().isString(),
  body('zip').optional().isString(),
];