import nodemailer from 'nodemailer';

/**
 * Email Service
 * Handles sending emails for verification and notifications
 * 
 * Uses Nodemailer with SMTP. Supports multiple email providers:
 * - Gmail (with App Password)
 * - Outlook/Hotmail
 * - Custom SMTP servers
 * - SendGrid (via SMTP)
 * - AWS SES (via SMTP)
 * - Mailgun (via SMTP)
 */

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on environment variables
   */
  private initializeTransporter() {
    const emailProvider = process.env.EMAIL_PROVIDER || 'console'; // 'console', 'smtp', 'gmail', 'sendgrid', 'ses'

    switch (emailProvider) {
      case 'smtp':
      case 'gmail':
      case 'sendgrid':
      case 'ses':
      case 'mailgun':
        this.transporter = nodemailer.createTransport(this.getSMTPConfig());
        break;
      case 'console':
      default:
        // Use console logging for development
        this.transporter = null;
        break;
    }
  }

  /**
   * Get SMTP configuration based on provider
   */
  private getSMTPConfig(): nodemailer.TransportOptions {
    const provider = process.env.EMAIL_PROVIDER || 'smtp';

    // Gmail configuration
    if (provider === 'gmail') {
      return {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD, // Use App Password, not regular password
        },
      } as any;
    }

    // SendGrid SMTP
    if (provider === 'sendgrid') {
      return {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      } as any;
    }

    // AWS SES SMTP
    if (provider === 'ses') {
      return {
        host: process.env.SES_HOST || `email-smtp.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com`,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SES_SMTP_USERNAME,
          pass: process.env.SES_SMTP_PASSWORD,
        },
      } as any;
    }

    // Mailgun SMTP
    if (provider === 'mailgun') {
      return {
        host: 'smtp.mailgun.org',
        port: 587,
        secure: false,
        auth: {
          user: process.env.MAILGUN_SMTP_USER,
          pass: process.env.MAILGUN_SMTP_PASSWORD,
        },
      } as any;
    }

    // Custom SMTP (default)
    return {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    } as any;
  }

  /**
   * Send verification code to email
   * @param email - Recipient email address
   * @param code - Verification code
   * @param firstName - User's first name (optional)
   */
  async sendVerificationCode(email: string, code: string, firstName?: string): Promise<void> {
    const subject = 'MedFlow - Email Verification Code';
    const textBody = `
Hello ${firstName || 'there'},

Thank you for registering with MedFlow!

Your verification code is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Best regards,
MedFlow Team
    `.trim();

    const htmlBody = this.generateVerificationEmailHTML(code, firstName);
    const fromEmail = process.env.FROM_EMAIL || 'noreply@medflow.com';
    const fromName = process.env.FROM_NAME || 'MedFlow';

    // If transporter is not initialized (console mode), log to console
    if (!this.transporter) {
      console.log('='.repeat(50));
      console.log('EMAIL VERIFICATION CODE (Console Mode)');
      console.log('='.repeat(50));
      console.log(`To: ${email}`);
      console.log(`From: ${fromName} <${fromEmail}>`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${textBody}`);
      console.log('='.repeat(50));
      return;
    }

    // Send email using Nodemailer
    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`Verification email sent successfully to ${email}`);
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email. Please try again later.');
    }
  }

  /**
   * Send password reset code to email
   * @param email - Recipient email address
   * @param code - Reset code
   * @param firstName - User's first name (optional)
   */
  async sendPasswordResetCode(email: string, code: string, firstName?: string): Promise<void> {
    const subject = 'MedFlow - Password Reset Code';
    const textBody = `
Hello ${firstName || 'there'},

You requested to reset your password for your MedFlow account.

Your password reset code is: ${code}

This code will expire in 15 minutes.

If you didn't request this password reset, please ignore this email and your password will remain unchanged.

For security reasons, please do not share this code with anyone.

Best regards,
MedFlow Team
    `.trim();

    const htmlBody = this.generatePasswordResetEmailHTML(code, firstName);
    const fromEmail = process.env.FROM_EMAIL || 'noreply@medflow.com';
    const fromName = process.env.FROM_NAME || 'MedFlow';

    // If transporter is not initialized (console mode), log to console
    if (!this.transporter) {
      console.log('='.repeat(50));
      console.log('PASSWORD RESET CODE (Console Mode)');
      console.log('='.repeat(50));
      console.log(`To: ${email}`);
      console.log(`From: ${fromName} <${fromEmail}>`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${textBody}`);
      console.log('='.repeat(50));
      return;
    }

    // Send email using Nodemailer
    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`Password reset email sent successfully to ${email}`);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email. Please try again later.');
    }
  }

  /**
   * Generate HTML email template for verification code
   */
  private generateVerificationEmailHTML(code: string, firstName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .code { font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background-color: white; margin: 20px 0; letter-spacing: 5px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MedFlow</h1>
    </div>
    <div class="content">
      <h2>Hello ${firstName || 'there'},</h2>
      <p>Thank you for registering with MedFlow!</p>
      <p>Your verification code is:</p>
      <div class="code">${code}</div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>MedFlow Team</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Send verification link to email (for admin-created users)
   * @param email - Recipient email address
   * @param token - Verification token
   * @param firstName - User's first name (optional)
   */
  async sendVerificationLink(email: string, token: string, firstName?: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationLink = `${frontendUrl}/setup-password?token=${token}`;

    const subject = 'MedFlow - Set Up Your Account Password';
    const textBody = `
Hello ${firstName || 'there'},

An account has been created for you in MedFlow. 

To activate your account and set your password, please click on the link below (or copy and paste it into your browser):

${verificationLink}

IMPORTANT: This is a link to click, NOT a verification code. Simply click the link above to open the password setup page.

This link will expire in 24 hours.

If you didn't expect this email, please contact your administrator.

Best regards,
MedFlow Team
    `.trim();

    const htmlBody = this.generateVerificationLinkEmailHTML(verificationLink, firstName);
    const fromEmail = process.env.FROM_EMAIL || 'noreply@medflow.com';
    const fromName = process.env.FROM_NAME || 'MedFlow';

    // If transporter is not initialized (console mode), log to console
    if (!this.transporter) {
      console.log('='.repeat(50));
      console.log('EMAIL VERIFICATION LINK (Console Mode)');
      console.log('='.repeat(50));
      console.log(`To: ${email}`);
      console.log(`From: ${fromName} <${fromEmail}>`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${textBody}`);
      console.log(`Verification Link: ${verificationLink}`);
      console.log('='.repeat(50));
      return;
    }

    // Send email using Nodemailer
    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`Verification link email sent successfully to ${email}`);
    } catch (error) {
      console.error('Error sending verification link email:', error);
      throw new Error('Failed to send verification email. Please try again later.');
    }
  }

  /**
   * Send registration verification link to email (for self-registration)
   * @param email - Recipient email address
   * @param token - Verification token
   * @param firstName - User's first name (optional)
   */
  async sendRegistrationVerificationLink(email: string, token: string, firstName?: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationLink = `${frontendUrl}/register/verify?token=${token}`;

    const subject = 'MedFlow - Set Your Password & Activate Account';
    const textBody = `
Hello ${firstName || 'there'},

Thank you for registering with MedFlow!

To complete your registration, set your password, and activate your account, please click on the link below:

${verificationLink}

IMPORTANT: This is a link to click, NOT a verification code. Simply click the link above to open the password setup page where you can create your password and activate your account.

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.

Best regards,
MedFlow Team
    `.trim();

    const htmlBody = this.generateRegistrationVerificationLinkEmailHTML(verificationLink, firstName);
    const fromEmail = process.env.FROM_EMAIL || 'noreply@medflow.com';
    const fromName = process.env.FROM_NAME || 'MedFlow';

    // If transporter is not initialized (console mode), log to console
    if (!this.transporter) {
      console.log('='.repeat(50));
      console.log('EMAIL REGISTRATION VERIFICATION LINK (Console Mode)');
      console.log('='.repeat(50));
      console.log(`To: ${email}`);
      console.log(`From: ${fromName} <${fromEmail}>`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${textBody}`);
      console.log(`Verification Link: ${verificationLink}`);
      console.log('='.repeat(50));
      return;
    }

    // Send email using Nodemailer
    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`Registration verification link email sent successfully to ${email}`);
    } catch (error) {
      console.error('Error sending registration verification link email:', error);
      throw new Error('Failed to send verification email. Please try again later.');
    }
  }

  /**
   * Generate HTML email template for registration verification link
   */
  private generateRegistrationVerificationLinkEmailHTML(link: string, firstName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .button { display: inline-block; padding: 12px 30px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .button:hover { background-color: #1565c0; }
    .link { word-break: break-all; color: #1976d2; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MedFlow</h1>
    </div>
    <div class="content">
      <h2>Hello ${firstName || 'there'},</h2>
      <p>Thank you for registering with MedFlow!</p>
      <p><strong>To complete your registration, please click the button below:</strong></p>
      <div style="text-align: center;">
        <a href="${link}" class="button">Verify Email & Activate Account</a>
      </div>
      <p style="margin-top: 20px; padding: 10px; background-color: #e3f2fd; border-left: 4px solid #1976d2;">
        <strong>Note:</strong> This is a link to click, NOT a verification code. Simply click the button above to verify your email and activate your account.
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p class="link">${link}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>MedFlow Team</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate HTML email template for verification link
   */
  private generateVerificationLinkEmailHTML(link: string, firstName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .button { display: inline-block; padding: 12px 30px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .button:hover { background-color: #1565c0; }
    .link { word-break: break-all; color: #1976d2; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MedFlow</h1>
    </div>
    <div class="content">
      <h2>Hello ${firstName || 'there'},</h2>
      <p>An account has been created for you in MedFlow.</p>
      <p><strong>To activate your account and set your password, please click the button below:</strong></p>
      <div style="text-align: center;">
        <a href="${link}" class="button">Set Up Your Password</a>
      </div>
      <p style="margin-top: 20px; padding: 10px; background-color: #e3f2fd; border-left: 4px solid #1976d2;">
        <strong>Note:</strong> This is a link to click, NOT a verification code. Simply click the button above to open the password setup page in your browser.
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p class="link">${link}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't expect this email, please contact your administrator.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>MedFlow Team</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Send appointment confirmation email to a patient
   * @param email - Recipient email address
   * @param firstName - Patient's first name
   * @param appointmentDateTime - Formatted appointment date/time string
   * @param providerName - Optional provider name
   */
  async sendAppointmentConfirmation(
    email: string,
    firstName: string | undefined,
    appointmentDateTime: string,
    providerName?: string
  ): Promise<void> {
    const subject = 'MedFlow - Your Appointment is Confirmed';
    const textBody = `
Hello ${firstName || 'there'},

Your appointment has been confirmed for:

${appointmentDateTime}${providerName ? `\nProvider: ${providerName}` : ''}

If you need to reschedule or have any questions, please contact our office.

Best regards,
MedFlow Team
    `.trim();

    const htmlBody = this.generateAppointmentConfirmationHTML(firstName, appointmentDateTime, providerName);
    const fromEmail = process.env.FROM_EMAIL || 'noreply@medflow.com';
    const fromName = process.env.FROM_NAME || 'MedFlow';

    if (!this.transporter) {
      console.log('='.repeat(50));
      console.log('APPOINTMENT CONFIRMATION EMAIL (Console Mode)');
      console.log('='.repeat(50));
      console.log(`To: ${email}`);
      console.log(`From: ${fromName} <${fromEmail}>`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${textBody}`);
      console.log('='.repeat(50));
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`Appointment confirmation email sent successfully to ${email}`);
    } catch (error) {
      console.error('Error sending appointment confirmation email:', error);
      throw new Error('Failed to send appointment confirmation email. Please try again later.');
    }
  }

  /**
   * Generate HTML email template for appointment confirmation
   */
  private generateAppointmentConfirmationHTML(
    firstName: string | undefined,
    appointmentDateTime: string,
    providerName?: string
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2e7d32; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .details { font-size: 18px; font-weight: bold; text-align: center; padding: 20px; background-color: white; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Appointment Confirmed</h1>
    </div>
    <div class="content">
      <h2>Hello ${firstName || 'there'},</h2>
      <p>Your appointment has been confirmed for:</p>
      <div class="details">
        ${appointmentDateTime}
        ${providerName ? `<br><span style="font-size: 14px; font-weight: normal;">Provider: ${providerName}</span>` : ''}
      </div>
      <p>If you need to reschedule or have any questions, please contact our office.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>MedFlow Team</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate HTML email template for password reset code
   */
  private generatePasswordResetEmailHTML(code: string, firstName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .code { font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background-color: white; margin: 20px 0; letter-spacing: 5px; color: #d32f2f; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MedFlow - Password Reset</h1>
    </div>
    <div class="content">
      <h2>Hello ${firstName || 'there'},</h2>
      <p>You requested to reset your password for your MedFlow account.</p>
      <p>Your password reset code is:</p>
      <div class="code">${code}</div>
      <p>This code will expire in 15 minutes.</p>
      <div class="warning">
        <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email and your password will remain unchanged.
      </div>
      <p>For security reasons, please do not share this code with anyone.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>MedFlow Team</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}

export const emailService = new EmailService();

