import type { MessagingProvider } from './types';
import { localMessagingProvider } from './local.provider';
import { twilioMessagingProvider } from './twilio.provider';

export type { MessagingProvider } from './types';

/**
 * Registered SMS-number providers. To add one (e.g. Telnyx):
 *   1. create telnyx.provider.ts implementing MessagingProvider,
 *   2. add it to this list,
 *   3. set MESSAGING_PROVIDER=telnyx (plus its credentials) in .env.
 */
const PROVIDERS: MessagingProvider[] = [localMessagingProvider, twilioMessagingProvider];

/**
 * Picks the provider from MESSAGING_PROVIDER. When unset, uses Twilio if its
 * credentials exist (how the app behaved before providers were pluggable),
 * otherwise the local demo provider. A provider that is named but unknown or
 * missing credentials falls back to local, with a warning, rather than
 * breaking Messaging Services.
 */
export const getMessagingProvider = (): MessagingProvider => {
  const requested = process.env.MESSAGING_PROVIDER?.trim().toLowerCase();

  if (!requested) {
    return twilioMessagingProvider.isConfigured() ? twilioMessagingProvider : localMessagingProvider;
  }

  const provider = PROVIDERS.find((p) => p.id === requested);
  if (!provider) {
    console.warn(
      `[messaging] Unknown MESSAGING_PROVIDER "${requested}". Supported: ${PROVIDERS.map((p) => p.id).join(', ')}. Using local.`
    );
    return localMessagingProvider;
  }
  if (!provider.isConfigured()) {
    console.warn(`[messaging] ${provider.label} is selected but its credentials are missing. Using local.`);
    return localMessagingProvider;
  }
  return provider;
};

export const getSupportedMessagingProviders = () => PROVIDERS.map((p) => p.id);
