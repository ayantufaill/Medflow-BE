import { body, param, query, ValidationChain } from 'express-validator';

export const roomIdValidator: ValidationChain[] = [
  param('roomId')
    .notEmpty()
    .withMessage('Room ID is required')
    .isLength({ min: 36, max: 36 })
    .withMessage('Invalid room ID format'),
];

export const createRoomValidator: ValidationChain[] = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim()
    .custom((value) => {
      if (!value || value.length === 0) {
        throw new Error('Name cannot be empty');
      }
      return true;
    })
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
];

export const updateRoomValidator: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .custom((value) => {
      if (value !== undefined && (!value || value.length === 0)) {
        throw new Error('Name cannot be empty');
      }
      return true;
    })
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const roomQueryValidator: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be either true or false'),
];

