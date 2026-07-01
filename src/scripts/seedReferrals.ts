import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

const specialists = [
  { firstName: 'John', lastName: 'Carter', specialty: 'Cardiology' },
  { firstName: 'Sarah', lastName: 'Mitchell', specialty: 'Neurology' },
  { firstName: 'David', lastName: 'Patel', specialty: 'Orthopedics' },
  { firstName: 'Linda', lastName: 'Chen', specialty: 'Dermatology' },
  { firstName: 'Robert', lastName: 'Torres', specialty: 'Gastroenterology' },
  { firstName: 'Angela', lastName: 'Kim', specialty: 'Endocrinology' },
  { firstName: 'Michael', lastName: 'Brown', specialty: 'Pulmonology' },
  { firstName: 'Emily', lastName: 'Davis', specialty: 'Rheumatology' },
  { firstName: 'James', lastName: 'Wilson', specialty: 'Nephrology' },
  { firstName: 'Patricia', lastName: 'Moore', specialty: 'Oncology' },
];

const reasons = [
  'Follow-up required after initial diagnosis',
  'Second opinion on treatment plan',
  'Specialist evaluation for chronic condition',
  'Post-surgical follow-up',
  'Diagnostic workup for complex case',
  'Medication management review',
  'Annual specialist review',
  'Urgent consultation requested',
  'Preventive care screening',
  'Pain management evaluation',
];

const seedReferrals = async () => {
  try {
    console.log('🌱 Seeding referral data...');

    // Get existing patients
    const patients = await prisma.patient.findMany({
      take: 20,
      select: { PatNum: true, FName: true, LName: true },
    });

    if (patients.length === 0) {
      console.error('❌ No patients found. Run seed:patients first.');
      process.exit(1);
    }

    console.log(`Found ${patients.length} patients to attach referrals to.`);

    // Step 1 — Create referral (specialist) records
    console.log('\nCreating specialists in referral table...');
    const createdReferrals: any[] = [];

    for (const specialist of specialists) {
      // Check if specialist already exists
      const existing = await prisma.referral.findFirst({
        where: {
          FName: specialist.firstName,
          LName: specialist.lastName,
        },
      });

      if (existing) {
        console.log(`  ⚠️  Specialist already exists: ${specialist.firstName} ${specialist.lastName}`);
        createdReferrals.push(existing);
        continue;
      }

      const referralNum = await getNextId('referral', 'ReferralNum');
      const referral = await prisma.referral.create({
        data: {
          ReferralNum: referralNum,
          FName: specialist.firstName,
          LName: specialist.lastName,
          IsHidden: 0,
          IsDoctor: 1,
          DisplayNote: specialist.specialty, // store specialty label for display
        },
      });

      createdReferrals.push(referral);
      console.log(`  ✓ Created specialist: Dr. ${specialist.firstName} ${specialist.lastName} (${specialist.specialty})`);
    }

    // Step 2 — Create refattach records linking patients to specialists
    console.log('\nCreating patient referral attachments...');
    let attachCount = 0;

    for (const patient of patients) {
      // Each patient gets 1-3 referrals
      const numReferrals = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < numReferrals; i++) {
        const specialist = createdReferrals[Math.floor(Math.random() * createdReferrals.length)];
        const reason = reasons[Math.floor(Math.random() * reasons.length)];

        // Random date in the past 12 months
        const daysAgo = Math.floor(Math.random() * 365);
        const refDate = new Date();
        refDate.setDate(refDate.getDate() - daysAgo);

        const refAttachNum = await getNextId('refattach', 'RefAttachNum');

        await prisma.refattach.create({
          data: {
            RefAttachNum: refAttachNum,
            PatNum: patient.PatNum,
            ReferralNum: specialist.ReferralNum,
            RefDate: refDate,
            Note: reason,
            RefType: 1, // 1 = Referral To
          },
        });

        attachCount++;
      }

      console.log(`  ✓ Created ${numReferrals} referral(s) for ${patient.FName} ${patient.LName}`);
    }

    // Step 3 — Verify counts
    const referralCount = await prisma.referral.count();
    const refAttachCount = await prisma.refattach.count();

    console.log('\n✅ Referral seeding complete!');
    console.log(`   Specialists (referral table): ${referralCount}`);
    console.log(`   Patient referrals (refattach table): ${refAttachCount}`);
    console.log(`   New attachments created: ${attachCount}`);

  } catch (error) {
    console.error('❌ Error seeding referrals:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedReferrals();