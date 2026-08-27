import { body, param, query, ValidationChain } from 'express-validator';

export const taskIdValidator: ValidationChain[] = [
  param('taskId')
    .notEmpty()
    .withMessage('Task ID is required')
    .isNumeric()
    .withMessage('Invalid task ID format'),
];

export const createTaskValidator: ValidationChain[] = [
  body('Descript')
    .notEmpty()
    .withMessage('Description (title) is required')
    .isString()
    .withMessage('Description must be a string')
    .trim(),
  body('TaskListNum')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('TaskListNum must be a numeric value'),
  body('PriorityDefNum')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('PriorityDefNum must be a numeric value'),
  body('DateTask')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('DateTask must be a valid ISO 8601 date'),
  body('dueTime')
    .optional({ nullable: true })
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('dueTime must be in HH:MM format (24-hour)'),
  body('KeyNum')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('KeyNum must be a numeric value'),
  body('assignedTo')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('assignedTo must be a numeric user ID'),
  body('IsRepeating')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 1 })
    .withMessage('IsRepeating must be 0 or 1'),
  body('ReminderFrequency')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('ReminderFrequency must be a non-negative integer'),
  body('comment')
    .optional({ nullable: true })
    .isString()
    .withMessage('comment must be a string')
    .trim(),
];

export const updateTaskValidator: ValidationChain[] = [
  body('Descript')
    .optional({ nullable: true })
    .isString()
    .withMessage('Description must be a string')
    .trim(),
  body('TaskListNum')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('TaskListNum must be a numeric value'),
  body('PriorityDefNum')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('PriorityDefNum must be a numeric value'),
  body('DateTask')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('DateTask must be a valid ISO 8601 date'),
  body('dueTime')
    .optional({ nullable: true })
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('dueTime must be in HH:MM format (24-hour)'),
  body('KeyNum')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('KeyNum must be a numeric value'),
  body('assignedTo')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('assignedTo must be a numeric user ID'),
  body('IsRepeating')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 1 })
    .withMessage('IsRepeating must be 0 or 1'),
  body('ReminderFrequency')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('ReminderFrequency must be a non-negative integer'),
  body('comment')
    .optional({ nullable: true })
    .isString()
    .withMessage('comment must be a string')
    .trim(),
  body('TaskStatus')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 2 })
    .withMessage('TaskStatus must be an integer (0=New, 1=Done, 2=InProgress)'),
];

export const taskQueryValidator: ValidationChain[] = [
  query('status')
    .optional()
    .isString()
    .withMessage('Status filter must be a string or comma-separated numbers'),
  query('taskListNum')
    .optional()
    .isNumeric()
    .withMessage('taskListNum must be numeric'),
  query('assignedTo')
    .optional()
    .isNumeric()
    .withMessage('assignedTo must be numeric'),
  query('createdDateFrom')
    .optional()
    .isISO8601()
    .withMessage('createdDateFrom must be a valid ISO date'),
  query('createdDateTo')
    .optional()
    .isISO8601()
    .withMessage('createdDateTo must be a valid ISO date'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isString()
    .withMessage('sortBy must be a string'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be asc or desc'),
];
