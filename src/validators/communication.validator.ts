import { body, param, query, type ValidationChain } from 'express-validator';

export const updateSettingsValidator: ValidationChain[] = [
  body('skippedDays')
    .optional()
    .isArray()
    .withMessage('skippedDays must be an array of date strings'),
  body('emailConfig')
    .optional()
    .isObject()
    .withMessage('emailConfig must be an object'),
  body('emailConfig.days')
    .optional()
    .isString()
    .withMessage('emailConfig.days must be a string'),
  body('emailConfig.startTime')
    .optional()
    .isString()
    .withMessage('emailConfig.startTime must be a string'),
  body('emailConfig.endTime')
    .optional()
    .isString()
    .withMessage('emailConfig.endTime must be a string'),
  body('textConfig')
    .optional()
    .isObject()
    .withMessage('textConfig must be an object'),
  body('textConfig.days')
    .optional()
    .isString()
    .withMessage('textConfig.days must be a string'),
  body('textConfig.startTime')
    .optional()
    .isString()
    .withMessage('textConfig.startTime must be a string'),
  body('textConfig.endTime')
    .optional()
    .isString()
    .withMessage('textConfig.endTime must be a string'),
  body('textConfig.enabledDays')
    .optional()
    .isArray()
    .withMessage('textConfig.enabledDays must be an array of strings'),
  body('reminders')
    .optional()
    .isArray()
    .withMessage('reminders must be an array'),
  body('socialLinks')
    .optional()
    .isObject()
    .withMessage('socialLinks must be an object'),
  body('mapCoords')
    .optional()
    .isObject()
    .withMessage('mapCoords must be an object'),
];

export const templateValidator: ValidationChain[] = [
  body('description')
    .notEmpty()
    .withMessage('Template description/name is required')
    .isString()
    .withMessage('Description must be a string'),
  body('subject')
    .optional()
    .isString()
    .withMessage('Subject must be a string'),
  body('bodyText')
    .notEmpty()
    .withMessage('Body text is required')
    .isString()
    .withMessage('Body text must be a string'),
  body('templateType')
    .notEmpty()
    .withMessage('Template type is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Template type must be an integer between 1 and 5'),
];

export const templateIdParamValidator: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Template ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid template ID format'),
];

export const campaignValidator: ValidationChain[] = [
  body('subject')
    .notEmpty()
    .withMessage('Campaign subject is required')
    .isString()
    .withMessage('Subject must be a string'),
  body('body')
    .notEmpty()
    .withMessage('Campaign body text is required')
    .isString()
    .withMessage('Body must be a string'),
  body('targetAudienceId')
    .optional()
    .isString()
    .withMessage('Target audience ID must be a string'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['Draft', 'Sent'])
    .withMessage('Status must be Draft or Sent'),
];

export const campaignIdParamValidator: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Campaign ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid campaign ID format'),
];

export const questionnaireValidator: ValidationChain[] = [
  body('description')
    .notEmpty()
    .withMessage('Questionnaire title/description is required')
    .isString()
    .withMessage('Description must be a string'),
  body('questions')
    .optional()
    .isArray()
    .withMessage('Questions must be an array'),
  body('questions.*.name')
    .notEmpty()
    .withMessage('Question name is required')
    .isString()
    .withMessage('Question name must be a string'),
  body('questions.*.type')
    .notEmpty()
    .withMessage('Question type is required')
    .isString()
    .withMessage('Question type must be a string'),
];

export const questionnaireIdParamValidator: ValidationChain[] = [
  param('id')
    .notEmpty()
    .withMessage('Questionnaire ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid questionnaire ID format'),
];

export const gapFillValidator: ValidationChain[] = [
  body('triggerType')
    .notEmpty()
    .withMessage('Trigger type is required')
    .isString()
    .withMessage('Trigger type must be a string'),
  body('templateId')
    .notEmpty()
    .withMessage('Template ID is required')
    .isString()
    .withMessage('Template ID must be a string'),
  body('isActive')
    .notEmpty()
    .withMessage('isActive is required')
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('scheduleOffsetDays')
    .notEmpty()
    .withMessage('scheduleOffsetDays is required')
    .isInt({ min: 0 })
    .withMessage('scheduleOffsetDays must be a non-negative integer'),
  body('maxOffers')
    .notEmpty()
    .withMessage('maxOffers is required')
    .isInt({ min: 1 })
    .withMessage('maxOffers must be a positive integer'),
];

export const updateReviewSettingsValidator: ValidationChain[] = [
  body('isActive')
    .notEmpty()
    .withMessage('isActive status is required')
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('sendDelayHours')
    .notEmpty()
    .withMessage('Send delay in hours is required')
    .isInt({ min: 0 })
    .withMessage('sendDelayHours must be a non-negative integer'),
  body('channels')
    .notEmpty()
    .withMessage('Channels is required')
    .isArray()
    .withMessage('channels must be an array of strings'),
  body('googleReviewUrl')
    .optional()
    .isString()
    .withMessage('googleReviewUrl must be a string'),
  body('facebookReviewUrl')
    .optional()
    .isString()
    .withMessage('facebookReviewUrl must be a string'),
  body('customMessageText')
    .notEmpty()
    .withMessage('Custom message text is required')
    .isString()
    .withMessage('customMessageText must be a string'),
];
