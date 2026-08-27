import { body, param } from 'express-validator';
import { FORM_FIELD_TYPES } from '../services/form-template.service';

const TEMPLATE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const templateIdParamValidator = [
  param('templateId')
    .trim()
    .notEmpty()
    .withMessage('templateId is required'),
];

// Per-field wildcard chains (fields.*.key etc.) simply have nothing to
// validate when `fields` itself is absent from the body, so the same chains
// serve both create (fields required) and update (fields optional) — only
// the top-level `fields` presence check differs between the two.
const fieldWildcardValidators = [
  body('fields.*.key')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each field requires a non-empty key'),
  body('fields.*.label')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each field requires a non-empty label'),
  // Sourced from FORM_FIELD_TYPES so new types (e.g. 'signature') are picked up
  // here automatically — nothing to change in this file when the enum grows.
  body('fields.*.type')
    .isString()
    .isIn(FORM_FIELD_TYPES as unknown as string[])
    .withMessage(`Each field's type must be one of: ${FORM_FIELD_TYPES.join(', ')}`),
  body('fields.*.required')
    .optional()
    .isBoolean()
    .withMessage('field.required must be a boolean'),
  body('fields.*.options')
    .optional({ nullable: true })
    .isArray()
    .withMessage('field.options must be an array of { value, label }'),
  body('fields.*.order')
    .optional()
    .isInt()
    .withMessage('field.order must be an integer'),
];

export const createFormTemplateValidator = [
  body('templateId')
    .trim()
    .notEmpty()
    .withMessage('templateId is required')
    .matches(TEMPLATE_ID_PATTERN)
    .withMessage('templateId must be lowercase, alphanumeric, hyphen-separated (e.g. "new-patient-intake")'),
  body('name').trim().notEmpty().withMessage('name is required'),
  body('description').optional({ nullable: true }).isString(),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('fields').isArray({ min: 1 }).withMessage('fields must be a non-empty array'),
  ...fieldWildcardValidators,
];

export const updateFormTemplateValidator = [
  ...templateIdParamValidator,
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('description').optional({ nullable: true }).isString(),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('fields').optional().isArray({ min: 1 }).withMessage('fields must be a non-empty array'),
  ...fieldWildcardValidators,
];
