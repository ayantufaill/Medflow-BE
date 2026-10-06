import { getMessagingProvider } from './messaging-providers';

/**
 * Two-way SMS number for the practice (Settings → Email & Messaging →
 * Messaging Services / Number Selection).
 *
 * Number search goes through the configured provider (./messaging-providers:
 * Twilio, or the local demo provider; others plug in there). Selecting a
 * number only records the choice (status "pending") — it never purchases one,
 * since buying a number costs money and needs the carrier (A2P 10DLC)
 * registration that follows practice-details confirmation.
 */

export type MessagingStatus = 'active' | 'pending' | 'inactive';

export interface MessagingServiceState {
  status: MessagingStatus;
  /** 10-digit US number, digits only. */
  phoneNumber: string | null;
  provider: string;
  selectedAt: string | null;
}

export interface PracticeDetails {
  legalBusinessName: string;
  doingBusinessAs: string;
  /** Only the last 4 digits are ever stored or returned. */
  einLast4: string | null;
  businessType: string;
  phoneNumber: string;
  website: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  owner: { name: string; phone: string | null; email: string };
}

export interface PracticeDetailsInput extends Omit<PracticeDetails, 'einLast4' | 'owner'> {
  /** Full EIN, only when the user is changing it. */
  ein?: string;
}

export const BUSINESS_TYPES = [
  'Sole proprietorship',
  'Partnership',
  'Limited liability company',
  'Corporation',
  'Non-profit organization',
] as const;

export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

// NANP: area code and exchange can't start with 0 or 1.
const US_NUMBER_PATTERN = /^[2-9]\d{2}[2-9]\d{6}$/;
const AREA_CODE_PATTERN = /^[2-9]\d{2}$/;
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i;

const digitsOnly = (value: unknown) => String(value ?? '').replace(/\D/g, '');

/** "+1 (201) 500-6314" / "12015006314" → "2015006314", or null if not a valid US number. */
export const normalizeUsPhone = (value: unknown): string | null => {
  let digits = digitsOnly(value);
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return US_NUMBER_PATTERN.test(digits) ? digits : null;
};

export const isValidAreaCode = (areaCode: unknown) => AREA_CODE_PATTERN.test(String(areaCode ?? ''));

/** State used when the practice hasn't chosen a number: the provider's configured sender, if any. */
export const defaultMessagingState = (): MessagingServiceState => {
  const provider = getMessagingProvider();
  const defaultNumber = provider.getDefaultNumber();
  return {
    status: defaultNumber ? 'active' : 'inactive',
    phoneNumber: defaultNumber,
    provider: provider.id,
    selectedAt: null,
  };
};

/** Field-level validation for step 1. Returns { field: message } for anything invalid. */
export const validatePracticeDetails = (input: Partial<PracticeDetailsInput>): Record<string, string> => {
  const fields: Record<string, string> = {};
  if (!input.legalBusinessName?.trim()) fields.legalBusinessName = 'Legal business name is required.';
  if (input.ein && digitsOnly(input.ein).length !== 9) fields.ein = 'EIN must be 9 digits, e.g. 12-3456789.';
  if (!BUSINESS_TYPES.includes(input.businessType as (typeof BUSINESS_TYPES)[number])) {
    fields.businessType = 'Select a business type.';
  }
  if (!normalizeUsPhone(input.phoneNumber)) fields.phoneNumber = 'Enter a valid 10-digit phone number.';
  if (input.website?.trim() && !WEBSITE_PATTERN.test(input.website.trim())) {
    fields.website = 'Enter a valid website, e.g. https://www.yourpractice.com';
  }
  if (!input.address?.trim()) fields.address = 'Practice address is required.';
  if (!input.city?.trim()) fields.city = 'City is required.';
  if (!US_STATE_CODES.includes(String(input.state ?? '').toUpperCase())) fields.state = 'Select a state.';
  if (!ZIP_PATTERN.test(input.zip?.trim() ?? '')) fields.zip = 'Enter a 5-digit ZIP or ZIP+4, e.g. 07446-1926.';
  return fields;
};

/** Trims and normalizes validated input; the full EIN is reduced to its last 4 digits. */
export const sanitizePracticeDetails = (
  input: PracticeDetailsInput,
  previousEinLast4: string | null
): Omit<PracticeDetails, 'owner'> => ({
  legalBusinessName: input.legalBusinessName.trim(),
  doingBusinessAs: input.doingBusinessAs?.trim() ?? '',
  einLast4: input.ein ? digitsOnly(input.ein).slice(-4) : previousEinLast4,
  businessType: input.businessType,
  phoneNumber: normalizeUsPhone(input.phoneNumber)!,
  website: input.website?.trim() ?? '',
  address: input.address.trim(),
  address2: input.address2?.trim() ?? '',
  city: input.city.trim(),
  state: input.state.toUpperCase(),
  zip: input.zip.trim(),
});

/** Up to 10 SMS-capable US numbers in the area code, from the configured provider. */
export const searchAvailableNumbers = async (areaCode: string): Promise<string[]> => {
  const numbers = await getMessagingProvider().searchAvailableNumbers(areaCode);
  return numbers.map(normalizeUsPhone).filter((n): n is string => Boolean(n));
};
