import twilio from 'twilio';
import type { MessagingProvider } from './types';

const toUsDigits = (value: string | undefined | null): string | null => {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
};

/** Uses TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN (and TWILIO_PHONE_NUMBER as the default sender). */
export const twilioMessagingProvider: MessagingProvider = {
  id: 'twilio',
  label: 'Twilio',

  isConfigured: () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),

  getDefaultNumber: () => toUsDigits(process.env.TWILIO_PHONE_NUMBER),

  searchAvailableNumbers: async (areaCode) => {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const results = await client.availablePhoneNumbers('US').local.list({
      areaCode: Number(areaCode),
      smsEnabled: true,
      limit: 10,
    });
    return results.map((n) => toUsDigits(n.phoneNumber)).filter((n): n is string => Boolean(n));
  },
};
