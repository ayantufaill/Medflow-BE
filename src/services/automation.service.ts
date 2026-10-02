import { randomUUID } from 'node:crypto';

/**
 * Automations (Admin → Patient Communication → Automations): per-category lists
 * of automated patient messages. This module holds the category rules,
 * validation and default messages; persistence lives in communication.service.
 *
 * Mirrors Medflow-FE src/components/admin/patient-communication/automations/automationConfig.js.
 * Sending on schedule is not implemented yet — `sent` / `recipients` stay 0
 * until a sender job records deliveries.
 */

export const AUTOMATION_CHANNELS = ['Preferred', 'SMS', 'Email', 'Email, SMS'] as const;
export const AUTOMATION_UNITS = ['Hours', 'Days', 'Weeks'] as const;

export type AutomationChannel = (typeof AUTOMATION_CHANNELS)[number];
export type AutomationUnit = (typeof AUTOMATION_UNITS)[number];
export type AutomationDirection = 'Before' | 'After';

export type AutomationTiming =
  | { type: 'event'; event: string }
  | { type: 'offset'; amount: number; unit: AutomationUnit; direction: AutomationDirection; anchor: string };

export interface AutomationMessage {
  id: string;
  timing: AutomationTiming;
  channel: AutomationChannel;
  subject: string;
  body: string;
  active: boolean;
  sent: number;
  recipients: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationInput {
  timing: AutomationTiming;
  channel: AutomationChannel;
  subject?: string;
  body: string;
}

interface CategoryRules {
  events: string[];
  anchors: string[];
  directions: AutomationDirection[];
}

export const AUTOMATION_CATEGORIES: Record<string, CategoryRules> = {
  'pre-appointment': {
    events: ['When Appointment Requested', 'When Appointment Created'],
    anchors: ['Confirmed Appointment', 'Unconfirmed Appointment'],
    directions: ['Before'],
  },
  'post-appointment': {
    events: [],
    anchors: ['Appointment Completed'],
    directions: ['After'],
  },
  'recall-reminders': {
    events: [],
    anchors: ['Prophy Due', 'Perio Due'],
    directions: ['Before', 'After'],
  },
  'incomplete-forms': {
    events: [],
    anchors: ['Confirmed Appointment', 'Unconfirmed Appointment'],
    directions: ['Before'],
  },
  'payment-reminders': {
    events: [
      'When Payment Plan Payment Processed',
      'When Payment Plan Started',
      'When Payment Plan Updated',
      'When Payment Plan Payment Failed',
    ],
    anchors: ['Payment Plan Payment'],
    directions: ['Before'],
  },
};

export type AutomationCategory = keyof typeof AUTOMATION_CATEGORIES;

export const isAutomationCategory = (value: unknown): value is AutomationCategory =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(AUTOMATION_CATEGORIES, value);

export const MAX_BODY_LENGTH = 1000;
const MAX_SUBJECT_LENGTH = 200;

/** Returns an error message, or null when the input is valid for the category. */
export const validateAutomation = (category: AutomationCategory, input: Partial<AutomationInput>): string | null => {
  const rules = AUTOMATION_CATEGORIES[category];
  const timing = input.timing;

  if (!timing || (timing.type !== 'event' && timing.type !== 'offset')) {
    return 'Select when this message should be sent.';
  }
  if (timing.type === 'event') {
    if (!rules.events.includes(timing.event)) return 'Select when this message should be sent.';
  } else {
    if (!Number.isInteger(timing.amount) || timing.amount < 1 || timing.amount > 365) {
      return 'Enter a valid timing between 1 and 365.';
    }
    if (!AUTOMATION_UNITS.includes(timing.unit)) return 'Select hours, days or weeks.';
    if (!rules.directions.includes(timing.direction)) return 'Select before or after.';
    if (!rules.anchors.includes(timing.anchor)) return 'Select what this message is timed from.';
  }

  if (!AUTOMATION_CHANNELS.includes(input.channel as AutomationChannel)) return 'Select a channel.';
  if (typeof input.body !== 'string' || !input.body.trim()) return 'Message cannot be empty.';
  if (input.body.length > MAX_BODY_LENGTH) return `Message must be ${MAX_BODY_LENGTH.toLocaleString()} characters or fewer.`;
  if (input.subject && input.subject.length > MAX_SUBJECT_LENGTH) return `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.`;
  return null;
};

/** Keeps only the fields that belong on a stored timing (drops anything extra the client sent). */
const cleanTiming = (timing: AutomationTiming): AutomationTiming =>
  timing.type === 'event'
    ? { type: 'event', event: timing.event }
    : { type: 'offset', amount: timing.amount, unit: timing.unit, direction: timing.direction, anchor: timing.anchor };

export const buildAutomation = (input: AutomationInput, now = new Date().toISOString()): AutomationMessage => ({
  id: randomUUID(),
  timing: cleanTiming(input.timing),
  channel: input.channel,
  // SMS has no subject line.
  subject: input.channel === 'SMS' ? '' : (input.subject ?? '').trim(),
  body: input.body.trim(),
  active: true,
  sent: 0,
  recipients: 0,
  createdAt: now,
  updatedAt: now,
});

export const applyAutomationUpdate = (existing: AutomationMessage, input: AutomationInput): AutomationMessage => ({
  ...existing,
  timing: cleanTiming(input.timing),
  channel: input.channel,
  subject: input.channel === 'SMS' ? '' : (input.subject ?? '').trim(),
  body: input.body.trim(),
  updatedAt: new Date().toISOString(),
});

export const summarizeAutomations = (messages: AutomationMessage[]) => ({
  actions: messages.length,
  totalSent: messages.reduce((sum, m) => sum + (m.sent ?? 0), 0),
  recipients: messages.reduce((sum, m) => sum + (m.recipients ?? 0), 0),
});

const event = (name: string): AutomationTiming => ({ type: 'event', event: name });
const offset = (amount: number, unit: AutomationUnit, direction: AutomationDirection, anchor: string): AutomationTiming => ({
  type: 'offset', amount, unit, direction, anchor,
});

type DefaultMessage = [AutomationTiming, AutomationChannel, string, boolean, string?];

/** Starter messages a practice gets the first time it opens Automations. */
const DEFAULTS: Record<AutomationCategory, DefaultMessage[]> = {
  'pre-appointment': [
    [event('When Appointment Requested'), 'Email, SMS', 'Hi {Patient: Preferred Name}, this is to confirm that your appointment request for {Appointment: Date} at {Appointment: Time} has been received. Our office will be in touch shortly.', false, 'We received your appointment request'],
    [event('When Appointment Created'), 'Email, SMS', 'Hi! This is to confirm that your appointment for {Patient: Preferred Name} with {Practice: Name} is scheduled for {Appointment: Date} at {Appointment: Time}.', true, 'Your appointment is confirmed'],
    [offset(7, 'Days', 'Before', 'Confirmed Appointment'), 'Preferred', 'Hi! This is a friendly reminder that your appointment for {Patient: First Name} at {Practice: Name} is on {Appointment: Date} at {Appointment: Time}.', true],
    [offset(7, 'Days', 'Before', 'Unconfirmed Appointment'), 'Preferred', 'Hi! Your appointment for {Patient: First Name} with {Practice: Name} is scheduled for {Appointment: Date}. Please confirm here: {Appointment: Confirm Link}', true],
    [offset(3, 'Days', 'Before', 'Unconfirmed Appointment'), 'Preferred', 'Hi! Your appointment for {Patient: First Name} with {Practice: Name} is scheduled for {Appointment: Date}. We haven’t heard back yet. Please confirm: {Appointment: Confirm Link}', true],
    [offset(1, 'Days', 'Before', 'Confirmed Appointment'), 'Preferred', 'Hi! We look forward to seeing {Patient: First Name} for their appointment tomorrow at {Appointment: Time}.', true],
    [offset(1, 'Days', 'Before', 'Unconfirmed Appointment'), 'Preferred', 'Hi! Please confirm your appointment for {Patient: First Name} with {Practice: Name} tomorrow at {Appointment: Time}: {Appointment: Confirm Link}', true],
  ],
  'post-appointment': [
    [offset(1, 'Hours', 'After', 'Appointment Completed'), 'SMS', 'Hi! We loved having {Patient: Preferred Name} with us today at {Practice: Name}. If you enjoyed your visit, we’d appreciate a review: {Review: Link}', true],
    [offset(24, 'Hours', 'After', 'Appointment Completed'), 'SMS', 'Hi! Just checking in after {Patient: First Name}’s visit yesterday! How is {Patient: Preferred Name} feeling? Reply to this message if you have any questions.', false],
  ],
  'recall-reminders': [
    [offset(6, 'Weeks', 'Before', 'Prophy Due'), 'SMS', 'Hi! {Patient: Preferred Name} is due for their next dental cleaning and exam with {Practice: Name}. Call us at {Practice: Phone} to schedule.', true],
    [offset(4, 'Weeks', 'Before', 'Perio Due'), 'SMS', 'Hi! {Patient: Preferred Name} is due for their next dental exam and cleaning appointment with {Practice: Name}. Call us at {Practice: Phone} to schedule.', true],
    [offset(2, 'Weeks', 'After', 'Prophy Due'), 'SMS', 'Hi! {Patient: Preferred Name} is overdue for their dental cleaning and exam with {Practice: Name}. Call us at {Practice: Phone} to book a visit.', true],
    [offset(2, 'Weeks', 'After', 'Perio Due'), 'SMS', 'Hi {Patient: Preferred Name}, you are overdue for your periodontal maintenance with {Practice: Name}. Call us at {Practice: Phone} to schedule.', false],
  ],
  'incomplete-forms': [
    [offset(3, 'Days', 'Before', 'Unconfirmed Appointment'), 'Preferred', 'Please complete the forms required for your appointment with {Practice: Name} on {Appointment: Date}: {Forms: Link}', true],
    [offset(3, 'Days', 'Before', 'Confirmed Appointment'), 'Preferred', 'Please complete the forms required for your appointment with {Practice: Name} on {Appointment: Date}: {Forms: Link}', true],
    [offset(1, 'Days', 'Before', 'Unconfirmed Appointment'), 'Preferred', 'Please complete the forms required for tomorrow’s appointment with {Practice: Name}: {Forms: Link}', true],
    [offset(1, 'Days', 'Before', 'Confirmed Appointment'), 'Preferred', 'Please complete the forms required for tomorrow’s appointment with {Practice: Name}: {Forms: Link}', true],
    [offset(1, 'Hours', 'Before', 'Unconfirmed Appointment'), 'Preferred', 'Please complete the forms required for today’s appointment with {Practice: Name}: {Forms: Link}', true],
    [offset(1, 'Hours', 'Before', 'Confirmed Appointment'), 'Preferred', 'Please complete the forms required for today’s appointment with {Practice: Name}: {Forms: Link}', true],
  ],
  'payment-reminders': [
    [event('When Payment Plan Payment Processed'), 'SMS', 'Hi {Patient: Preferred Name}, a payment of {Payment Plan: Payment Amount} was collected on your payment plan with {Practice: Name}. Thank you!', false],
    [event('When Payment Plan Started'), 'SMS', 'Hi {Patient: Preferred Name}, a payment plan totaling {Payment Plan: Total Amount} has been set up with {Practice: Name}. Your next payment is on {Payment Plan: Next Payment Date}.', false],
    [event('When Payment Plan Updated'), 'SMS', 'Hi {Patient: Preferred Name}, your payment plan at {Practice: Name} was updated. Your next payment is on {Payment Plan: Next Payment Date}.', false],
    [event('When Payment Plan Payment Failed'), 'SMS', 'Hi {Patient: Preferred Name}, {Practice: Name} was unable to process a recent payment on your payment plan. Please update your payment details: {Payment Plan: Payment Link}', false],
    [offset(1, 'Days', 'Before', 'Payment Plan Payment'), 'SMS', 'Hi {Patient: Preferred Name}, an upcoming payment on your payment plan with {Practice: Name} of {Payment Plan: Payment Amount} is scheduled for tomorrow.', false],
  ],
};

export const buildDefaultAutomations = (): Record<AutomationCategory, AutomationMessage[]> => {
  const now = new Date().toISOString();
  return Object.fromEntries(
    Object.entries(DEFAULTS).map(([category, messages]) => [
      category,
      messages.map(([timing, channel, body, active, subject]) => ({
        ...buildAutomation({ timing, channel, body, subject }, now),
        active,
      })),
    ])
  ) as Record<AutomationCategory, AutomationMessage[]>;
};
