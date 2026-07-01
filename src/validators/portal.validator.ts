import { body, param, query, type ValidationChain } from 'express-validator';

const isNumericIdString = (value: unknown) =>
  typeof value === 'string' && /^\d+$/.test(value.trim());

const idValidator = (field: string, label: string, source: 'body' | 'param' | 'query') => {
  const chain =
    source === 'body' ? body(field) : source === 'param' ? param(field) : query(field);
  return chain
    .notEmpty()
    .withMessage(`${label} is required`)
    .custom((value) => isNumericIdString(value))
    .withMessage(`Invalid ${label.toLowerCase()} format`);
};

export const portalPaginationValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

export const portalProfileUpdateValidator: ValidationChain[] = [
  body('firstName').optional().isString().withMessage('firstName must be a string'),
  body('lastName').optional().isString().withMessage('lastName must be a string'),
  body('phonePrimary').optional().isString().withMessage('phonePrimary must be a string'),
  body('phoneSecondary').optional().isString().withMessage('phoneSecondary must be a string'),
  body('email').optional().isEmail().withMessage('email must be a valid email'),
  body('preferredLanguage').optional().isString().withMessage('preferredLanguage must be a string'),
  body('communicationPreference')
    .optional()
    .isIn(['phone', 'email', 'sms', 'portal'])
    .withMessage('communicationPreference must be one of: phone, email, sms, portal'),
  body('address').optional().isObject().withMessage('address must be an object'),
  body('insurance').optional().isObject().withMessage('insurance must be an object'),
  body('insurance.insuranceCompanyId')
    .optional({ values: 'falsy' })
    .custom((value) => isNumericIdString(value))
    .withMessage('Invalid insurance company ID format'),
  body('insurance.policyNumber')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('insurance.policyNumber must be a string'),
];

export const portalAppointmentQueryValidator: ValidationChain[] = [
  ...portalPaginationValidator,
  query('status')
    .optional()
    .isIn(['scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'])
    .withMessage('Invalid status'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO8601 date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO8601 date'),
];

export const portalSlotsQueryValidator: ValidationChain[] = [
  idValidator('providerId', 'Provider ID', 'query'),
  query('date').notEmpty().withMessage('date is required').isISO8601().withMessage('date must be a valid ISO8601 date'),
  query('durationMinutes')
    .optional()
    .isInt({ min: 5 })
    .withMessage('durationMinutes must be at least 5'),
];

export const portalBookAppointmentValidator: ValidationChain[] = [
  idValidator('providerId', 'Provider ID', 'body'),
  body('appointmentTypeId')
    .optional()
    .custom((value) => isNumericIdString(value))
    .withMessage('Invalid appointment type ID format'),
  body('appointmentDate')
    .notEmpty()
    .withMessage('appointmentDate is required')
    .isISO8601()
    .withMessage('appointmentDate must be a valid ISO8601 date'),
  body('startTime')
    .notEmpty()
    .withMessage('startTime is required')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('startTime must be in HH:MM format'),
  body('endTime')
    .notEmpty()
    .withMessage('endTime is required')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('endTime must be in HH:MM format'),
  body('durationMinutes').optional().isInt({ min: 5 }).withMessage('durationMinutes must be at least 5'),
  body('chiefComplaint').optional().isString().withMessage('chiefComplaint must be a string'),
  body('notes').optional().isString().withMessage('notes must be a string'),
  body('roomId')
    .optional()
    .custom((value) => isNumericIdString(value))
    .withMessage('Invalid room ID format'),
];

export const portalAppointmentIdValidator: ValidationChain[] = [
  idValidator('appointmentId', 'Appointment ID', 'param'),
];

export const portalRescheduleAppointmentValidator: ValidationChain[] = [
  body('newDate')
    .notEmpty()
    .withMessage('newDate is required')
    .isISO8601()
    .withMessage('newDate must be a valid ISO8601 date'),
  body('newStartTime')
    .notEmpty()
    .withMessage('newStartTime is required')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('newStartTime must be in HH:MM format'),
  body('newEndTime')
    .notEmpty()
    .withMessage('newEndTime is required')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('newEndTime must be in HH:MM format'),
];

export const portalCancelAppointmentValidator: ValidationChain[] = [
  body('cancellationReason')
    .optional()
    .isString()
    .withMessage('cancellationReason must be a string'),
];

export const portalThreadIdValidator: ValidationChain[] = [
  param('threadId').notEmpty().withMessage('Thread ID is required').isString().withMessage('threadId must be a string'),
];

export const portalSendMessageValidator: ValidationChain[] = [
  body('providerId')
    .optional({ values: 'falsy' })
    .custom((value) => isNumericIdString(value))
    .withMessage('Invalid provider ID format'),
  body('providerIds')
    .optional()
    .isArray({ min: 1 })
    .withMessage('providerIds must be a non-empty array'),
  body('providerIds.*')
    .optional()
    .custom((value) => isNumericIdString(value))
    .withMessage('Invalid provider ID format'),
  body('subject').optional().isString().withMessage('subject must be a string'),
  body('threadId').optional().isString().withMessage('threadId must be a string'),
  body('message')
    .notEmpty()
    .withMessage('message is required')
    .isString()
    .withMessage('message must be a string'),
  body().custom((value) => {
    const hasThreadId = Boolean(value?.threadId && String(value.threadId).trim());
    const hasProviderId = Boolean(value?.providerId && String(value.providerId).trim());
    const hasProviderIds = Array.isArray(value?.providerIds) && value.providerIds.length > 0;
    if (!hasThreadId && !hasProviderId && !hasProviderIds) {
      throw new Error('providerId, providerIds, or threadId is required');
    }
    return true;
  }),
];

export const portalSubmitFormValidator: ValidationChain[] = [
  body('templateId').optional().isString().withMessage('templateId must be a string'),
  body('requestId').optional().isString().withMessage('requestId must be a string'),
  body('sourceSection').optional().isString().withMessage('sourceSection must be a string'),
  body('formData').notEmpty().withMessage('formData is required').isObject().withMessage('formData must be an object'),
];

export const portalFormIdValidator: ValidationChain[] = [
  idValidator('formId', 'Form ID', 'param'),
];

export const portalUpdateFormValidator: ValidationChain[] = [
  body('templateId').optional().isString().withMessage('templateId must be a string'),
  body('requestId').optional().isString().withMessage('requestId must be a string'),
  body('sourceSection').optional().isString().withMessage('sourceSection must be a string'),
  body('formData').notEmpty().withMessage('formData is required').isObject().withMessage('formData must be an object'),
];

export const portalProviderReplyValidator: ValidationChain[] = [
  body('threadId')
    .notEmpty()
    .withMessage('threadId is required')
    .isString()
    .withMessage('threadId must be a string'),
  body('subject').optional().isString().withMessage('subject must be a string'),
  body('message')
    .notEmpty()
    .withMessage('message is required')
    .isString()
    .withMessage('message must be a string'),
];

export const portalProviderPatientIdValidator: ValidationChain[] = [
  idValidator('patientId', 'Patient ID', 'param'),
];

export const portalNotificationIdValidator: ValidationChain[] = [
  idValidator('notificationId', 'Notification ID', 'param'),
];

export const portalNotificationPreferencesValidator: ValidationChain[] = [
  body('emailEnabled').optional().isBoolean().withMessage('emailEnabled must be a boolean'),
  body('smsEnabled').optional().isBoolean().withMessage('smsEnabled must be a boolean'),
  body('inAppEnabled').optional().isBoolean().withMessage('inAppEnabled must be a boolean'),
  body('appointmentReminderHours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('appointmentReminderHours must be between 1 and 168'),
];
