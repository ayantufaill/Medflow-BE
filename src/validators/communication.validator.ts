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
    .optional()
    .isString()
    .withMessage('Template ID must be a string'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('scheduleOffsetDays')
    .notEmpty()
    .withMessage('scheduleOffsetDays is required')
    .isInt({ min: 0 })
    .withMessage('scheduleOffsetDays must be a non-negative integer'),
  body('maxOffers')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxOffers must be a positive integer'),
];

export const gapFillSettingsValidator: ValidationChain[] = [
  body('unscheduledNotificationEnabled')
    .optional()
    .isBoolean()
    .withMessage('unscheduledNotificationEnabled must be a boolean'),
  body('showBookNow')
    .optional()
    .isBoolean()
    .withMessage('showBookNow must be a boolean'),
  body('skipDays')
    .optional()
    .isNumeric()
    .withMessage('skipDays must be numeric'),
];

export const updateReviewSettingsValidator: ValidationChain[] = [
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('notifications').optional().isArray().withMessage('notifications must be an array'),
  body('notifications.*.id').optional().isString(),
  body('notifications.*.method').optional().isIn(['SMS', 'Email']),
  body('notifications.*.time').optional().isNumeric(),
  body('notifications.*.frequency').optional().isIn(['Hours', 'Days']),
  body('enablePhoneCallRequests').optional().isBoolean().withMessage('enablePhoneCallRequests must be a boolean'),
  body('includeFacebookReview').optional().isBoolean().withMessage('includeFacebookReview must be a boolean'),
  body('includeYelpReview').optional().isBoolean().withMessage('includeYelpReview must be a boolean'),
  body('skipDuplicateDays').optional().isNumeric().withMessage('skipDuplicateDays must be numeric'),
  body('googleReviewLink').optional().isString().withMessage('googleReviewLink must be a string'),
  body('reputationManagementActive').optional().isBoolean().withMessage('reputationManagementActive must be a boolean'),
];

export const bulkTextValidator: ValidationChain[] = [
  body('patientIds')
    .isArray({ min: 1 })
    .withMessage('patientIds must be a non-empty array of strings'),
  body('patientIds.*')
    .isString()
    .withMessage('Each patientId must be a string'),
  body('message')
    .notEmpty()
    .withMessage('message is required')
    .isString()
    .withMessage('message must be a string'),
];

export const bulkEmailValidator: ValidationChain[] = [
  body('patientIds')
    .isArray({ min: 1 })
    .withMessage('patientIds must be a non-empty array of strings'),
  body('patientIds.*')
    .isString()
    .withMessage('Each patientId must be a string'),
  body('subject')
    .notEmpty()
    .withMessage('subject is required')
    .isString()
    .withMessage('subject must be a string'),
  body('message')
    .notEmpty()
    .withMessage('message is required')
    .isString()
    .withMessage('message must be a string'),
];

export const emailDomainValidator: ValidationChain[] = [
  body('domain')
    .notEmpty()
    .withMessage('domain is required')
    .isString()
    .withMessage('domain must be a string')
    .isLength({ max: 253 })
    .withMessage('domain must be at most 253 characters'),
];

export const emailPreferencesValidator: ValidationChain[] = [
  body('sentFromEmail')
    .isString()
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address.'),
  body('replyToEmail')
    .isString()
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address.'),
];

// Field rules live in messaging-number.service (validatePracticeDetails) so the
// response can carry per-field messages; this only guards the payload shape.
export const messagingPracticeDetailsValidator: ValidationChain[] = [
  body('legalBusinessName').isString().withMessage('legalBusinessName must be a string'),
  body('doingBusinessAs').optional().isString().withMessage('doingBusinessAs must be a string'),
  body('ein').optional({ values: 'falsy' }).isString().withMessage('ein must be a string'),
  body('businessType').isString().withMessage('businessType must be a string'),
  body('phoneNumber').isString().withMessage('phoneNumber must be a string'),
  body('website').optional().isString().withMessage('website must be a string'),
  body('address').isString().withMessage('address must be a string'),
  body('address2').optional().isString().withMessage('address2 must be a string'),
  body('city').isString().withMessage('city must be a string'),
  body('state').isString().withMessage('state must be a string'),
  body('zip').isString().withMessage('zip must be a string'),
];

export const messagingNumberSearchValidator: ValidationChain[] = [
  query('areaCode')
    .matches(/^[2-9]\d{2}$/)
    .withMessage('Enter a valid 3-digit area code.'),
];

export const messagingNumberSelectValidator: ValidationChain[] = [
  body('phoneNumber').isString().notEmpty().withMessage('phoneNumber is required'),
];

const AUTOMATION_CATEGORY_IDS = [
  'pre-appointment',
  'post-appointment',
  'recall-reminders',
  'incomplete-forms',
  'payment-reminders',
];

// Shape checks only; per-category timing rules live in automation.service (validateAutomation).
const automationBodyRules: ValidationChain[] = [
  body('timing').isObject().withMessage('timing is required'),
  body('timing.type').isIn(['event', 'offset']).withMessage('timing.type must be "event" or "offset"'),
  body('channel').isString().withMessage('channel is required'),
  body('subject').optional().isString().withMessage('subject must be a string'),
  body('body').isString().withMessage('body is required'),
];

export const automationListValidator: ValidationChain[] = [
  query('category').isIn(AUTOMATION_CATEGORY_IDS).withMessage(`category must be one of: ${AUTOMATION_CATEGORY_IDS.join(', ')}`),
];

export const automationCreateValidator: ValidationChain[] = [
  body('category').isIn(AUTOMATION_CATEGORY_IDS).withMessage(`category must be one of: ${AUTOMATION_CATEGORY_IDS.join(', ')}`),
  ...automationBodyRules,
];

export const automationUpdateValidator: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid automation id'),
  ...automationBodyRules,
];

export const automationActiveValidator: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid automation id'),
  body('active').isBoolean({ strict: true }).withMessage('active must be true or false'),
];

export const automationIdParamValidator: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid automation id'),
];
