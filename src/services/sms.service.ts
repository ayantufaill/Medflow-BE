import twilio from 'twilio';

/**
 * SMS Service
 * Sends text messages via Twilio. Falls back to console logging when
 * TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER are not configured,
 * matching the pattern used by EmailService for local/dev environments.
 */
export class SmsService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string | undefined;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && this.fromNumber) {
      this.client = twilio(accountSid, authToken);
    }
  }

  async sendSms(toPhone: string, message: string): Promise<void> {
    if (!this.client || !this.fromNumber) {
      console.log('='.repeat(50));
      console.log('SMS (Console Mode - Twilio not configured)');
      console.log('='.repeat(50));
      console.log(`To: ${toPhone}`);
      console.log(`Body:\n${message}`);
      console.log('='.repeat(50));
      return;
    }

    try {
      await this.client.messages.create({
        to: toPhone,
        from: this.fromNumber,
        body: message,
      });
      console.log(`SMS sent successfully to ${toPhone}`);
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw new Error('Failed to send SMS. Please try again later.');
    }
  }
}

export const smsService = new SmsService();
