import { body, ValidationChain } from 'express-validator';
import { validatePasswordStrength } from '../utils/password.util';

export const registerValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('password')
  .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      const validation = validatePasswordStrength(value);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      return true;
    }),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('preferredLanguage')
    .optional()
    .isIn(['en', 'es', 'fr', 'de'])
    .withMessage('Preferred language must be one of: en, es, fr, de'),
  body('roleId')
    .optional()
    .isString()
    .withMessage('Role ID must be a string')
    .trim()
    .notEmpty()
    .withMessage('Role ID cannot be empty'),
];

export const loginValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

export const refreshTokenValidator: ValidationChain[] = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
];

export const changePasswordValidator: ValidationChain[] = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .custom((value) => {
      const validation = validatePasswordStrength(value);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      return true;
    }),
];

export const verifyEmailValidator: ValidationChain[] = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
    .isString()
    .withMessage('Token must be a string'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      const validation = validatePasswordStrength(value);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      return true;
    }),
];

export const resendCodeValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
];

export const requestPasswordResetValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
];

export const verifyPasswordResetValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('code')
    .notEmpty()
    .withMessage('Reset code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Reset code must be 6 digits')
    .matches(/^\d{6}$/)
    .withMessage('Reset code must contain only digits'),
];

export const resetPasswordValidator: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('code')
    .notEmpty()
    .withMessage('Reset code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Reset code must be 6 digits')
    .matches(/^\d{6}$/)
    .withMessage('Reset code must contain only digits'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .custom((value) => {
      const validation = validatePasswordStrength(value);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      return true;
    }),
];

export const setupPasswordValidator: ValidationChain[] = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
    .isString()
    .withMessage('Token must be a string'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      const validation = validatePasswordStrength(value);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      return true;
    }),
];

