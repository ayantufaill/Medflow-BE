/**
 * Seeds sample Email & Messaging settings (Admin → Patient Communication →
 * Email & Messaging) through the same service methods the API uses, so the
 * data passes the real validation. Re-running resets to this sample state.
 *
 * Usage: npx tsx src/scripts/seedEmailMessaging.ts
 */
import { prisma } from '../config/db';
import { communicationService } from '../services/communication.service';

const SAMPLE = {
  domain: 'brightsmiledental.com',
  preferences: {
    sentFromEmail: 'noreply@brightsmiledental.com',
    replyToEmail: 'info@brightsmiledental.com',
  },
  practiceDetails: {
    legalBusinessName: 'Bright Smile Dental Group LLC',
    doingBusinessAs: 'Bright Smile Dental',
    ein: '12-3459859',
    businessType: 'Limited liability company',
    phoneNumber: '2015006314',
    website: 'https://www.brightsmiledental.com',
    address: '125 East Main Street',
    address2: 'Suite 200',
    city: 'Ramsey',
    state: 'NJ',
    zip: '07446-1926',
  },
  messagingNumber: '2015550142',
};

// Owner isn't stored; the API always uses the signed-in admin.
const SCRIPT_OWNER = { name: 'Seed Script', phone: null, email: 'seed@medflow.local' };

const PREFS = [
  'medflow.communication.email-domain',
  'medflow.communication.email-preferences',
  'medflow.communication.messaging-service',
  'medflow.communication.messaging-practice-details',
];

async function main() {
  const { count } = await prisma.clinicpref.deleteMany({ where: { PrefName: { in: PREFS } } });
  console.log(`Cleared ${count} existing Email & Messaging setting(s).`);

  const domain = await communicationService.setEmailDomain(SAMPLE.domain);
  console.log(`Email domain: ${domain.domain} (${domain.status}, ${domain.records.length} DNS records)`);

  const prefs = await communicationService.updateEmailPreferences(SAMPLE.preferences);
  console.log(`Email preferences: sent from ${prefs.sentFromEmail}, reply to ${prefs.replyToEmail}`);

  const details = await communicationService.updateMessagingPracticeDetails(SAMPLE.practiceDetails, SCRIPT_OWNER);
  console.log(`Practice details: ${details.legalBusinessName} (EIN ****${details.einLast4})`);

  const messaging = await communicationService.selectMessagingNumber(SAMPLE.messagingNumber);
  console.log(`Messaging number: ${messaging.phoneNumber} (${messaging.status})`);
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
