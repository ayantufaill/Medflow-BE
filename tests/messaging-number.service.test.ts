import { describe, it, expect, afterEach, vi } from 'vitest';

import {
  normalizeUsPhone,
  isValidAreaCode,
  validatePracticeDetails,
  sanitizePracticeDetails,
  searchAvailableNumbers,
  defaultMessagingState,
  type PracticeDetailsInput,
} from '../src/services/messaging-number.service';

const validDetails: PracticeDetailsInput = {
  legalBusinessName: ' Bright Smile Dental Group LLC ',
  doingBusinessAs: 'Bright Smile Dental',
  businessType: 'Limited liability company',
  phoneNumber: '(201) 500-6314',
  website: 'https://www.brightsmiledental.com',
  address: '125 East Main Street',
  address2: '',
  city: 'Ramsey',
  state: 'nj',
  zip: '07446-1926',
};

describe('messaging-number.service', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('normalizeUsPhone', () => {
    it('accepts formatted and +1-prefixed US numbers', () => {
      expect(normalizeUsPhone('(201) 500-6314')).toBe('2015006314');
      expect(normalizeUsPhone('+1 201-500-6314')).toBe('2015006314');
      expect(normalizeUsPhone('12015006314')).toBe('2015006314');
    });

    it('rejects short numbers and invalid area codes/exchanges', () => {
      expect(normalizeUsPhone('123')).toBeNull();
      expect(normalizeUsPhone('1015006314')).toBeNull(); // area code starts with 1
      expect(normalizeUsPhone('2011006314')).toBeNull(); // exchange starts with 1
      expect(normalizeUsPhone(null)).toBeNull();
    });
  });

  it('validates area codes', () => {
    expect(isValidAreaCode('201')).toBe(true);
    expect(isValidAreaCode('101')).toBe(false);
    expect(isValidAreaCode('20')).toBe(false);
  });

  describe('validatePracticeDetails', () => {
    it('accepts a complete, valid payload', () => {
      expect(validatePracticeDetails(validDetails)).toEqual({});
    });

    it('reports every invalid field at once', () => {
      const fields = validatePracticeDetails({
        ...validDetails,
        legalBusinessName: ' ',
        ein: '12-345',
        businessType: 'Pirate ship',
        phoneNumber: '555',
        website: 'not a site',
        state: 'ZZ',
        zip: '123',
      });
      expect(Object.keys(fields).sort()).toEqual(
        ['businessType', 'ein', 'legalBusinessName', 'phoneNumber', 'state', 'website', 'zip'].sort()
      );
    });

    it('treats website and EIN as optional', () => {
      expect(validatePracticeDetails({ ...validDetails, website: '', ein: '' })).toEqual({});
    });
  });

  describe('sanitizePracticeDetails', () => {
    it('trims, normalizes and keeps only the last 4 EIN digits', () => {
      const result = sanitizePracticeDetails({ ...validDetails, ein: '12-3456789' }, '1111');
      expect(result).toMatchObject({
        legalBusinessName: 'Bright Smile Dental Group LLC',
        phoneNumber: '2015006314',
        state: 'NJ',
        einLast4: '6789',
      });
      expect(JSON.stringify(result)).not.toContain('3456789');
    });

    it('keeps the previous EIN when none is submitted', () => {
      expect(sanitizePracticeDetails(validDetails, '9859').einLast4).toBe('9859');
    });
  });

  describe('without Twilio credentials', () => {
    it('searches the local inventory for the area code', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', '');
      vi.stubEnv('TWILIO_AUTH_TOKEN', '');
      const numbers = await searchAvailableNumbers('512');
      expect(numbers.length).toBeGreaterThan(0);
      numbers.forEach((n) => expect(n).toMatch(/^512555\d{4}$/));
    });

    it('defaults to an inactive service', () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', '');
      vi.stubEnv('TWILIO_AUTH_TOKEN', '');
      vi.stubEnv('TWILIO_PHONE_NUMBER', '');
      expect(defaultMessagingState()).toMatchObject({ status: 'inactive', phoneNumber: null, provider: 'local' });
    });
  });
});
