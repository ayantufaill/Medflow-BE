# Email Service Configuration Guide

This guide explains how to configure email sending for the MedFlow application. The email service uses **Nodemailer** which supports multiple email providers.

## Installation

The required packages are already in `package.json`. Install them with:

```bash
npm install
```

## Email Provider Options

The email service supports multiple providers. Choose one based on your needs:

### 1. **Console Mode (Development - Default)**

Logs emails to console instead of sending. Perfect for development.

### 2. **Gmail**

Good for development and small-scale applications.

### 3. **SendGrid**

Professional email service with good deliverability. Free tier: 100 emails/day.

### 4. **AWS SES (Simple Email Service)**

Scalable and cost-effective. Free tier: 62,000 emails/month (if on EC2).

### 5. **Mailgun**

Developer-friendly with good API. Free tier: 5,000 emails/month for 3 months.

### 6. **Custom SMTP**

Use any SMTP server (Outlook, custom mail server, etc.)

---

## Configuration

Add these environment variables to your `.env` file:

### Basic Configuration (Required for all providers)

```env
# Email Provider: 'console', 'smtp', 'gmail', 'sendgrid', 'ses', 'mailgun'
EMAIL_PROVIDER=console

# Sender Information
FROM_EMAIL=noreply@medflow.com
FROM_NAME=MedFlow
```

---

## Provider-Specific Setup

### Option 1: Console Mode (Development)

```env
EMAIL_PROVIDER=console
FROM_EMAIL=noreply@medflow.com
FROM_NAME=MedFlow
```

**Pros:**

- No setup required
- Perfect for development
- Emails logged to console

**Cons:**

- Doesn't actually send emails

---

### Option 2: Gmail

```env
EMAIL_PROVIDER=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=MedFlow
```

**Setup Steps:**

1. Enable 2-Step Verification on your Google Account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an App Password for "Mail"
4. Use the generated 16-character password (not your regular Gmail password)

**Pros:**

- Free
- Easy setup
- Good for development

**Cons:**

- Limited to 500 emails/day
- Requires App Password setup
- Not ideal for production

---

### Option 3: SendGrid (Recommended for Production)

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=MedFlow
```

**Setup Steps:**

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Verify your sender email/domain
3. Create an API Key in Settings > API Keys
4. Copy the API key to your `.env` file

**Pros:**

- Free tier: 100 emails/day forever
- Excellent deliverability
- Professional service
- Good analytics

**Cons:**

- Requires domain verification for production
- Free tier has daily limits

**Pricing:** Free (100/day) → $19.95/month (40,000 emails)

---

### Option 4: AWS SES

```env
EMAIL_PROVIDER=ses
AWS_REGION=us-west-2
SES_SMTP_USERNAME=your-ses-smtp-username
SES_SMTP_PASSWORD=your-ses-smtp-password
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=MedFlow
```

**Setup Steps:**

1. Sign up for [AWS](https://aws.amazon.com/)
2. Go to AWS SES Console
3. Verify your email/domain
4. Create SMTP credentials in SES > SMTP Settings
5. Copy username and password to `.env`

**Pros:**

- Very cost-effective ($0.10 per 1,000 emails)
- Highly scalable
- Free tier: 62,000 emails/month (if on EC2)
- Enterprise-grade reliability

**Cons:**

- Requires AWS account setup
- Account starts in "sandbox mode" (can only send to verified emails)
- Need to request production access

**Pricing:** $0.10 per 1,000 emails (after free tier)

---

### Option 5: Mailgun

```env
EMAIL_PROVIDER=mailgun
MAILGUN_SMTP_USER=your-mailgun-smtp-user
MAILGUN_SMTP_PASSWORD=your-mailgun-smtp-password
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=MedFlow
```

**Setup Steps:**

1. Sign up at [Mailgun](https://www.mailgun.com/)
2. Verify your domain
3. Get SMTP credentials from Domain Settings
4. Copy credentials to `.env`

**Pros:**

- Free tier: 5,000 emails/month for 3 months
- Developer-friendly
- Good API

**Cons:**

- Free tier is temporary
- Requires domain verification

**Pricing:** Free (5K/month for 3 months) → $35/month (50,000 emails)

---

### Option 6: Custom SMTP (Outlook, Custom Server, etc.)

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
FROM_EMAIL=your-email@outlook.com
FROM_NAME=MedFlow
```

**Common SMTP Settings:**

**Outlook/Hotmail:**

- Host: `smtp.office365.com`
- Port: `587`
- Secure: `false`

**Yahoo:**

- Host: `smtp.mail.yahoo.com`
- Port: `587`
- Secure: `false`

**Custom Mail Server:**

- Use your mail provider's SMTP settings

**Pros:**

- Works with any SMTP server
- No third-party service needed
- Use existing email infrastructure

**Cons:**

- Requires SMTP server access
- May have sending limits
- Deliverability depends on server reputation

---

## Testing Email Configuration

After configuring your `.env` file, test the email service:

1. Start your backend server
2. Try registering a new user
3. Check:
   - **Console mode**: Check server logs
   - **Real email**: Check the recipient's inbox (and spam folder)

---

## Troubleshooting

### Emails not sending

1. **Check environment variables**: Ensure all required variables are set
2. **Check credentials**: Verify API keys/passwords are correct
3. **Check spam folder**: Emails might be filtered
4. **Check server logs**: Look for error messages
5. **Verify sender email**: Some providers require email/domain verification

### Common Errors

**"Invalid login"**

- Wrong credentials
- For Gmail: Make sure you're using App Password, not regular password

**"Connection timeout"**

- Check SMTP host and port
- Check firewall settings
- Verify network connectivity

**"Email not verified"**

- AWS SES: Verify sender email in SES console
- SendGrid: Verify sender in SendGrid dashboard

---

## Production Recommendations

For production, we recommend:

1. **SendGrid** - Best balance of free tier and features
2. **AWS SES** - Best for high volume and cost-effectiveness
3. **Mailgun** - Good developer experience

**Important for Production:**

- Always verify your domain (not just email)
- Set up SPF, DKIM, and DMARC records
- Monitor email delivery rates
- Use a dedicated sending domain (e.g., `noreply@yourdomain.com`)

---

## Security Notes

- Never commit `.env` file to version control
- Use environment variables for all sensitive data
- Rotate API keys/passwords regularly
- Use App Passwords for Gmail (not regular passwords)

---

## Support

For issues with:

- **Nodemailer**: [Nodemailer Documentation](https://nodemailer.com/)
- **SendGrid**: [SendGrid Support](https://support.sendgrid.com/)
- **AWS SES**: [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- **Mailgun**: [Mailgun Documentation](https://documentation.mailgun.com/)
