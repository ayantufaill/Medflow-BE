/**
 * Contract every SMS-number provider (Twilio, Telnyx, Bandwidth, ...) implements.
 * The rest of the app only talks to this interface, so switching providers is
 * a config change (MESSAGING_PROVIDER) plus one adapter file — see ./index.ts.
 */
export interface MessagingProvider {
  /** Stable key stored on the practice's messaging state, e.g. 'twilio'. */
  readonly id: string;
  /** Human-readable name for logs and errors. */
  readonly label: string;

  /** True when the credentials this provider needs are present. */
  isConfigured(): boolean;

  /**
   * The practice's existing sending number from configuration, if any
   * (10-digit US, digits only). Used before the practice picks its own.
   */
  getDefaultNumber(): string | null;

  /** Up to 10 SMS-capable US numbers in the area code (10-digit, digits only). */
  searchAvailableNumbers(areaCode: string): Promise<string[]>;
}
