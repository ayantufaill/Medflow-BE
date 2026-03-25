import { prisma } from '../config/db';
import { providerService } from '../services/provider.service';
import { getNextId } from '../utils/opendental-ids.util';
import { hashPassword } from '../utils/password.util';
import { setUserMeta } from '../utils/opendental-auth.util';

// Standard Mon–Fri 8 am–5 pm schedule
const weekdayHours = [1, 2, 3, 4, 5].map((day) => ({
  dayOfWeek: day,
  startTime: '08:00',
  endTime: '17:00',
  isAvailable: true,
}));

const providers = [
  {
    user: {
      email: 'sarah.mitchell@medflow.com',
      firstName: 'Sarah',
      lastName: 'Mitchell',
    },
    profile: {
      npiNumber: '1234567890',
      licenseNumber: 'TX-DDS-44821',
      title: 'DDS',
      specialty: 'General Dentistry',
      appointmentBufferMinutes: 10,
      maxDailyAppointments: 12,
      consultationFee: 150,
      isAcceptingNewPatients: true,
      telehealthEnabled: false,
      workingHours: weekdayHours,
    },
  },
  {
    user: {
      email: 'james.patel@medflow.com',
      firstName: 'James',
      lastName: 'Patel',
    },
    profile: {
      npiNumber: '2345678901',
      licenseNumber: 'TX-DMD-39204',
      title: 'DMD',
      specialty: 'Orthodontics',
      appointmentBufferMinutes: 15,
      maxDailyAppointments: 10,
      consultationFee: 200,
      isAcceptingNewPatients: true,
      telehealthEnabled: true,
      workingHours: weekdayHours,
    },
  },
  {
    user: {
      email: 'linda.chen@medflow.com',
      firstName: 'Linda',
      lastName: 'Chen',
    },
    profile: {
      npiNumber: '3456789012',
      licenseNumber: 'FL-DDS-71053',
      title: 'DDS',
      specialty: 'Periodontics',
      appointmentBufferMinutes: 10,
      maxDailyAppointments: 10,
      consultationFee: 175,
      isAcceptingNewPatients: true,
      telehealthEnabled: false,
      workingHours: weekdayHours,
    },
  },
  {
    user: {
      email: 'robert.torres@medflow.com',
      firstName: 'Robert',
      lastName: 'Torres',
    },
    profile: {
      npiNumber: '4567890123',
      licenseNumber: 'NY-DDS-58830',
      title: 'DDS',
      specialty: 'Oral Surgery',
      appointmentBufferMinutes: 20,
      maxDailyAppointments: 8,
      consultationFee: 250,
      isAcceptingNewPatients: false,
      telehealthEnabled: false,
      workingHours: weekdayHours,
    },
  },
  {
    user: {
      email: 'angela.kim@medflow.com',
      firstName: 'Angela',
      lastName: 'Kim',
    },
    profile: {
      npiNumber: '5678901234',
      licenseNumber: 'CA-DMD-62917',
      title: 'DMD',
      specialty: 'Endodontics',
      appointmentBufferMinutes: 10,
      maxDailyAppointments: 10,
      consultationFee: 200,
      isAcceptingNewPatients: true,
      telehealthEnabled: true,
      workingHours: weekdayHours,
    },
  },
];

const seedProviders = async () => {
  const adminUser = await prisma.userod.findFirst({ orderBy: { UserNum: 'asc' } });
  if (!adminUser) {
    console.error('No admin user found — run seed:users first.');
    return;
  }
  const seedUserId = adminUser.UserNum.toString();

  let created = 0;
  let skipped = 0;

  for (const { user, profile } of providers) {
    // 1. Ensure user account exists
    let userRecord = await prisma.userod.findFirst({ where: { UserName: user.email } });

    if (!userRecord) {
      const nextId = await getNextId('userod', 'UserNum');
      const passwordHash = await hashPassword('Provider123!');
      userRecord = await prisma.userod.create({
        data: { UserNum: nextId, UserName: user.email, Password: passwordHash, IsHidden: 0 },
      });
      await setUserMeta(userRecord.UserNum, {
        email: user.email,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        preferredLanguage: 'en',
        isActive: true,
        tokenVersion: 0,
      });
    }

    const userId = userRecord.UserNum.toString();

    // 2. Create provider profile
    try {
      await providerService.createProvider({ userId, ...profile }, seedUserId);
      console.log(`  Created provider: Dr. ${user.firstName} ${user.lastName} (${profile.specialty})`);
      created++;
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        console.log(`  Skipped (existing): Dr. ${user.firstName} ${user.lastName}`);
        skipped++;
      } else {
        console.error(`  Failed: Dr. ${user.firstName} ${user.lastName} — ${err?.message}`);
      }
    }
  }

  console.log(`\nProvider seeding complete. Created: ${created}, Skipped: ${skipped}`);
};

seedProviders()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
