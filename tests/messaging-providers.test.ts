import { describe, it, expect, afterEach, vi } from 'vitest';

import { getMessagingProvider, getSupportedMessagingProviders } from '../src/services/messaging-providers';

const withTwilioCredentials = () => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC_test');
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'token_test');
};

const withoutTwilioCredentials = () => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', '');
  vi.stubEnv('TWILIO_AUTH_TOKEN', '');
};

describe('getMessagingProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('lists the registered providers', () => {
    expect(getSupportedMessagingProviders()).toEqual(expect.arrayContaining(['local', 'twilio']));
  });

  describe('when MESSAGING_PROVIDER is unset', () => {
    it('uses Twilio if its credentials exist', () => {
      vi.stubEnv('MESSAGING_PROVIDER', '');
      withTwilioCredentials();
      expect(getMessagingProvider().id).toBe('twilio');
    });

    it('uses the local demo provider otherwise', () => {
      vi.stubEnv('MESSAGING_PROVIDER', '');
      withoutTwilioCredentials();
      expect(getMessagingProvider().id).toBe('local');
    });
  });

  it('honours an explicit choice, case-insensitively', () => {
    vi.stubEnv('MESSAGING_PROVIDER', ' Local ');
    withTwilioCredentials();
    expect(getMessagingProvider().id).toBe('local');
  });

  it('falls back to local with a warning for an unknown provider', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('MESSAGING_PROVIDER', 'carrier-pigeon');
    expect(getMessagingProvider().id).toBe('local');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown MESSAGING_PROVIDER'));
  });

  it('falls back to local when the chosen provider has no credentials', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('MESSAGING_PROVIDER', 'twilio');
    withoutTwilioCredentials();
    expect(getMessagingProvider().id).toBe('local');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('credentials are missing'));
  });

  it("uses the provider's configured sender as the default number", () => {
    vi.stubEnv('MESSAGING_PROVIDER', 'twilio');
    withTwilioCredentials();
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+1 (201) 500-6314');
    expect(getMessagingProvider().getDefaultNumber()).toBe('2015006314');
  });
});
