import type { MessagingProvider } from './types';

/**
 * Development/demo provider with no external account. Returns 555-01xx
 * numbers, which are reserved for fictional use and can never reach a real line.
 */
export const localMessagingProvider: MessagingProvider = {
  id: 'local',
  label: 'Local (demo)',

  isConfigured: () => true,

  getDefaultNumber: () => null,

  searchAvailableNumbers: async (areaCode) =>
    ['0142', '0178', '0193', '0126', '0111', '0157'].map((suffix) => `${areaCode}555${suffix}`),
};
