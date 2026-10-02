import { describe, it, expect } from 'vitest';

import {
  validateAutomation,
  buildAutomation,
  applyAutomationUpdate,
  buildDefaultAutomations,
  summarizeAutomations,
  isAutomationCategory,
  AUTOMATION_CATEGORIES,
  type AutomationInput,
} from '../src/services/automation.service';

const recallInput: AutomationInput = {
  timing: { type: 'offset', amount: 3, unit: 'Days', direction: 'Before', anchor: 'Prophy Due' },
  channel: 'SMS',
  body: '  Hi {Patient: First Name}, you are due soon.  ',
};

describe('automation.service', () => {
  it('recognizes the five categories only', () => {
    expect(Object.keys(AUTOMATION_CATEGORIES)).toHaveLength(5);
    expect(isAutomationCategory('pre-appointment')).toBe(true);
    expect(isAutomationCategory('toString')).toBe(false);
    expect(isAutomationCategory('unknown')).toBe(false);
  });

  describe('validateAutomation', () => {
    it('accepts a valid scheduled message', () => {
      expect(validateAutomation('recall-reminders', recallInput)).toBeNull();
    });

    it("accepts an event from the category's list", () => {
      expect(
        validateAutomation('pre-appointment', { ...recallInput, timing: { type: 'event', event: 'When Appointment Created' } })
      ).toBeNull();
    });

    it("rejects an event from another category", () => {
      expect(
        validateAutomation('recall-reminders', { ...recallInput, timing: { type: 'event', event: 'When Appointment Created' } })
      ).toMatch(/when this message/);
    });

    it("rejects an anchor or direction the category doesn't allow", () => {
      expect(
        validateAutomation('pre-appointment', {
          ...recallInput,
          timing: { type: 'offset', amount: 1, unit: 'Days', direction: 'Before', anchor: 'Prophy Due' },
        })
      ).toMatch(/timed from/);
      expect(
        validateAutomation('pre-appointment', {
          ...recallInput,
          timing: { type: 'offset', amount: 1, unit: 'Days', direction: 'After', anchor: 'Confirmed Appointment' },
        })
      ).toMatch(/before or after/);
    });

    it('enforces amount 1-365 as a whole number', () => {
      for (const amount of [0, 366, 1.5]) {
        expect(
          validateAutomation('recall-reminders', { ...recallInput, timing: { ...recallInput.timing, amount } as AutomationInput['timing'] })
        ).toMatch(/between 1 and 365/);
      }
    });

    it('rejects a bad channel, empty or overlong body', () => {
      expect(validateAutomation('recall-reminders', { ...recallInput, channel: 'Fax' as never })).toMatch(/channel/);
      expect(validateAutomation('recall-reminders', { ...recallInput, body: '   ' })).toMatch(/empty/);
      expect(validateAutomation('recall-reminders', { ...recallInput, body: 'x'.repeat(1001) })).toMatch(/1,000/);
    });
  });

  it('builds an active message with trimmed text and no subject for SMS', () => {
    const msg = buildAutomation({ ...recallInput, subject: 'ignored' });
    expect(msg).toMatchObject({ active: true, sent: 0, recipients: 0, subject: '', body: 'Hi {Patient: First Name}, you are due soon.' });
    expect(msg.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('drops extra timing fields the client sends', () => {
    const msg = buildAutomation({
      ...recallInput,
      timing: { ...recallInput.timing, event: 'sneaky' } as unknown as AutomationInput['timing'],
    });
    expect(msg.timing).not.toHaveProperty('event');
  });

  it('updates content but keeps id, active flag and counters', () => {
    const original = { ...buildAutomation(recallInput), active: false, sent: 9, recipients: 4 };
    const updated = applyAutomationUpdate(original, { ...recallInput, channel: 'Email', subject: ' Due ', body: 'New' });
    expect(updated).toMatchObject({ id: original.id, active: false, sent: 9, recipients: 4, channel: 'Email', subject: 'Due', body: 'New' });
  });

  it('seeds valid defaults for every category', () => {
    const defaults = buildDefaultAutomations();
    expect(Object.keys(defaults).sort()).toEqual(Object.keys(AUTOMATION_CATEGORIES).sort());
    for (const [category, messages] of Object.entries(defaults)) {
      expect(messages.length).toBeGreaterThan(0);
      for (const m of messages) {
        expect(validateAutomation(category as keyof typeof AUTOMATION_CATEGORIES, m)).toBeNull();
      }
    }
  });

  it('summarizes counts', () => {
    const a = { ...buildAutomation(recallInput), sent: 3, recipients: 2 };
    const b = { ...buildAutomation(recallInput), sent: 1, recipients: 1 };
    expect(summarizeAutomations([a, b])).toEqual({ actions: 2, totalSent: 4, recipients: 3 });
  });
});
