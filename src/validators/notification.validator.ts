import { param, query, ValidationChain } from 'express-validator';

export const notificationIdValidator: ValidationChain[] = [
  param('notificationId')
    .notEmpty()
    .withMessage('Notification ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid notification ID format'),
];

export const notificationQueryValidator: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];
