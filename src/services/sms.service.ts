import twilio from 'twilio';

/**
 * SMS Service
 * Sends text messages via Twilio. Falls back to console logging when
 * TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER are not configured,
 * matching the pattern used by EmailService for local/dev environments.
 */
// Twilio's public WhatsApp Sandbox number - used when TWILIO_WHATSAPP_NUMBER isn't set.
// Recipients must first message this number with their sandbox join code.
const TWILIO_WHATSAPP_SANDBOX_NUMBER = 'whatsapp:+14155238886';

// Sandbox's pre-approved "Appointment Reminders" content template
// ("Your appointment is coming up on {{1}} at {{2}}...") - business-initiated
// WhatsApp messages must use an approved template until the recipient replies,
// so the first message can't carry freeform text.
const DEFAULT_WHATSAPP_APPOINTMENT_CONTENT_SID = 'HXb5b62575e6e4ff6129ad7c8efe1f983e';

export class SmsService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string | undefined;
  private whatsappFromNumber: string | undefined;
  private whatsappAppointmentContentSid: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.whatsappFromNumber = process.env.TWILIO_WHATSAPP_NUMBER
      ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`
      : TWILIO_WHATSAPP_SANDBOX_NUMBER;
    this.whatsappAppointmentContentSid =
      process.env.TWILIO_WHATSAPP_CONTENT_SID || DEFAULT_WHATSAPP_APPOINTMENT_CONTENT_SID;

    if (accountSid && authToken) {
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

  /**
   * Polls Twilio for a message's real delivery status. The create() call only
   * confirms Twilio *accepted* the request - for WhatsApp, delivery can still
   * fail a moment later (e.g. code 63016/63024: recipient hasn't opted in /
   * joined the sandbox), so we check before telling the caller it went through.
   */
  private async verifyDelivered(sid: string, toPhone: string): Promise<void> {
    const terminalStatuses = ['delivered', 'read', 'sent', 'failed', 'undelivered'];
    let lastStatus = 'queued';
    let lastErrorMessage: string | null = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const fetched = await this.client!.messages(sid).fetch();
      lastStatus = fetched.status;
      lastErrorMessage = fetched.errorMessage;
      if (terminalStatuses.includes(lastStatus)) break;
    }

    if (lastStatus === 'failed' || lastStatus === 'undelivered') {
      console.error(`WhatsApp message to ${toPhone} was not delivered (status: ${lastStatus}): ${lastErrorMessage}`);
      throw new Error(
        lastErrorMessage?.includes('63016') || lastErrorMessage?.includes('63024') || lastErrorMessage?.includes('63015')
          ? 'Recipient has not joined the WhatsApp sandbox yet'
          : lastErrorMessage || 'WhatsApp message could not be delivered'
      );
    }

    console.log(`WhatsApp message to ${toPhone} status: ${lastStatus}`);
  }

  /**
   * Sends the appointment confirmation via WhatsApp using the pre-approved
   * "Appointment Reminders" content template (business-initiated WhatsApp
   * messages can't carry freeform text until the recipient has replied).
   */
  async sendWhatsAppAppointmentConfirmation(toPhone: string, date: string, time: string): Promise<void> {
    if (!this.client) {
      console.log('='.repeat(50));
      console.log('WHATSAPP (Console Mode - Twilio not configured)');
      console.log('='.repeat(50));
      console.log(`To: ${toPhone}`);
      console.log(`Template: Your appointment is coming up on ${date} at ${time}.`);
      console.log('='.repeat(50));
      return;
    }

    try {
      const message = await this.client.messages.create({
        to: `whatsapp:${toPhone}`,
        from: this.whatsappFromNumber,
        contentSid: this.whatsappAppointmentContentSid,
        contentVariables: JSON.stringify({ '1': date, '2': time }),
      });
      await this.verifyDelivered(message.sid, toPhone);
      console.log(`WhatsApp message sent successfully to ${toPhone}`);
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send WhatsApp message. Please try again later.');
    }
  }

  /** Freeform WhatsApp send - only works within the 24h window after the recipient has replied. */
  async sendWhatsApp(toPhone: string, message: string): Promise<void> {
    if (!this.client) {
      console.log('='.repeat(50));
      console.log('WHATSAPP (Console Mode - Twilio not configured)');
      console.log('='.repeat(50));
      console.log(`To: ${toPhone}`);
      console.log(`Body:\n${message}`);
      console.log('='.repeat(50));
      return;
    }

    try {
      await this.client.messages.create({
        to: `whatsapp:${toPhone}`,
        from: this.whatsappFromNumber,
        body: message,
      });
      console.log(`WhatsApp message sent successfully to ${toPhone}`);
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw new Error('Failed to send WhatsApp message. Please try again later.');
    }
  }
}

export const smsService = new SmsService();
