import { prisma } from '../config/db';
import { providerService } from '../services/provider.service';
import { patientWorkspaceService } from '../services/patient-workspace.service';
import { getNextId } from '../utils/opendental-ids.util';
import { hashPassword } from '../utils/password.util';
import { setUserMeta } from '../utils/opendental-auth.util';

// ---------------------------------------------------------------------------
// 5 dental hygienists — one assigned to each seeded dentist
// ---------------------------------------------------------------------------

const assistants = [
  {
    user: { email: 'emily.torres@medflow.com', firstName: 'Emily', lastName: 'Torres' },
    profile: {
      npiNumber: '6111222333',
      licenseNumber: 'TX-RDH-18204',
      title: 'RDH',
      specialty: 'Dental Hygiene',
      appointmentBufferMinutes: 5,
      maxDailyAppointments: 14,
      consultationFee: 0,
      isAcceptingNewPatients: true,
      telehealthEnabled: false,
      workingHours: [1, 2, 3, 4, 5].map((day) => ({ dayOfWeek: day, startTime: '08:00', endTime: '17:00', isAvailable: true })),
    },
    // Assigned to Dr. Sarah Mitchell (provider index 0)
    dentistEmail: 'sarah.mitchell@medflow.com',
  },
  {
    user: { email: 'marcus.johnson@medflow.com', firstName: 'Marcus', lastName: 'Johnson' },
    profile: {
      npiNumber: '6222333444',
      licenseNumber: 'TX-RDH-29531',
      title: 'RDH',
      specialty: 'Dental Hygiene',
      appointmentBufferMinutes: 5,
      maxDailyAppointments: 14,
      consultationFee: 0,
      isAcceptingNewPatients: true,
      telehealthEnabled: false,
      workingHours: [1, 2, 3, 4, 5].map((day) => ({ dayOfWeek: day, startTime: '08:00', endTime: '17:00', isAvailable: true })),
    },
    dentistEmail: 'james.patel@medflow.com',
  },
  {
    user: { email: 'amy.park@medflow.com', firstName: 'Amy', lastName: 'Park' },
    profile: {
      npiNumber: '6333444555',
      licenseNumber: 'FL-RDH-41872',
      title: 'RDH',
      specialty: 'Dental Hygiene',
      appointmentBufferMinutes: 5,
      maxDailyAppointments: 12,
      consultationFee: 0,
      isAcceptingNewPatients: true,
      telehealthEnabled: false,
      workingHours: [1, 2, 3, 4, 5].map((day) => ({ dayOfWeek: day, startTime: '08:00', endTime: '17:00', isAvailable: true })),
    },
    dentistEmail: 'linda.chen@medflow.com',
  },
  {
    user: { email: 'carlos.rivera@medflow.com', firstName: 'Carlos', lastName: 'Rivera' },
    profile: {
      npiNumber: '6444555666',
      licenseNumber: 'NY-RDH-53049',
      title: 'DA',
      specialty: 'Dental Assisting',
      appointmentBufferMinutes: 5,
      maxDailyAppointments: 10,
      consultationFee: 0,
      isAcceptingNewPatients: false,
      telehealthEnabled: false,
      workingHours: [1, 2, 3, 4, 5].map((day) => ({ dayOfWeek: day, startTime: '08:00', endTime: '17:00', isAvailable: true })),
    },
    dentistEmail: 'robert.torres@medflow.com',
  },
  {
    user: { email: 'jessica.wong@medflow.com', firstName: 'Jessica', lastName: 'Wong' },
    profile: {
      npiNumber: '6555666777',
      licenseNumber: 'CA-RDH-64310',
      title: 'RDH',
      specialty: 'Dental Hygiene',
      appointmentBufferMinutes: 5,
      maxDailyAppointments: 12,
      consultationFee: 0,
      isAcceptingNewPatients: true,
      telehealthEnabled: false,
      workingHours: [1, 2, 3, 4, 5].map((day) => ({ dayOfWeek: day, startTime: '08:00', endTime: '17:00', isAvailable: true })),
    },
    dentistEmail: 'angela.kim@medflow.com',
  },
];

// Patient emails grouped by their assigned dentist (matches seedPatients + seedAppointments order)
const PATIENT_GROUPS: Record<string, string[]> = {
  'sarah.mitchell@medflow.com': [
    'james.harrison@example.com',
    'maria.gonzalez@example.com',
    'david.kim@example.com',
    'patricia.williams@example.com',
    'michael.thompson@example.com',
  ],
  'james.patel@medflow.com': [
    'jennifer.martinez@example.com',
    'robert.johnson@example.com',
    'ashley.brown@example.com',
    'christopher.davis@example.com',
    'amanda.wilson@example.com',
  ],
  'linda.chen@medflow.com': [
    'matthew.anderson@example.com',
    'sophia.taylor@example.com',
    'daniel.jackson@example.com',
    'emily.white@example.com',
    'joshua.harris@example.com',
  ],
  'robert.torres@medflow.com': [
    'olivia.martin@example.com',
    'andrew.garcia@example.com',
    'samantha.lee@example.com',
    'kevin.robinson@example.com',
    'lauren.clark@example.com',
  ],
  'angela.kim@medflow.com': [
    'tyler.lewis@example.com',
    'natalie.walker@example.com',
    'brandon.hall@example.com',
    'rachel.young@example.com',
    'jason.allen@example.com',
  ],
};

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

const seedAssistants = async () => {
  const adminUser = await prisma.userod.findFirst({ orderBy: { UserNum: 'asc' } });
  if (!adminUser) {
    console.error('No admin user found — run seed:users first.');
    return;
  }
  const seedUserId = adminUser.UserNum.toString();

  // Build dentist email → ProvNum map
  const dentistUsers = await prisma.userod.findMany({
    where: { UserName: { in: assistants.map((a) => a.dentistEmail) } },
    select: { UserNum: true, UserName: true },
  });
  const dentistUserIds = new Map(dentistUsers.map((u) => [u.UserName, u.UserNum.toString()]));

  const dentistProviders = await Promise.all(
    assistants.map(async (a) => {
      const userId = dentistUserIds.get(a.dentistEmail);
      if (!userId) return [a.dentistEmail, null] as const;
      const provider = await prisma.provider.findFirst({ where: { CustomID: userId } });
      return [a.dentistEmail, provider ? provider.ProvNum.toString() : null] as const;
    })
  );
  const dentistProviderMap = new Map(dentistProviders);

  // Seed each assistant
  const assistantProviderMap = new Map<string, string>(); // dentistEmail → assistantProvId

  let created = 0;
  let skipped = 0;

  for (const { user, profile, dentistEmail } of assistants) {
    // 1. Ensure user account exists
    let userRecord = await prisma.userod.findFirst({ where: { UserName: user.email } });
    if (!userRecord) {
      const nextId = await getNextId('userod', 'UserNum');
      const passwordHash = await hashPassword('Assistant123!');
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
    let assistantProvId: string | null = null;
    try {
      const result = await providerService.createProvider({ userId, ...profile }, seedUserId);
      assistantProvId = result._id;
      console.log(`  Created: ${user.firstName} ${user.lastName}, ${profile.title} — assigned to ${dentistEmail}`);
      created++;
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        // Look up existing
        const existing = await prisma.provider.findFirst({ where: { CustomID: userId } });
        if (existing) assistantProvId = existing.ProvNum.toString();
        console.log(`  Skipped (existing): ${user.firstName} ${user.lastName}`);
        skipped++;
      } else {
        console.error(`  Failed: ${user.firstName} ${user.lastName} — ${err?.message}`);
        continue;
      }
    }

    if (assistantProvId) assistantProviderMap.set(dentistEmail, assistantProvId);
  }

  // ---------------------------------------------------------------------------
  // Link patients to their dentist (preferredDentistId) and hygienist (preferredHygienistId)
  // ---------------------------------------------------------------------------

  console.log('\n  Linking patients to dentist + hygienist...');

  let linked = 0;
  let linkFailed = 0;

  for (const [dentistEmail, patientEmails] of Object.entries(PATIENT_GROUPS)) {
    const dentistProvId = dentistProviderMap.get(dentistEmail) ?? null;
    const hygienistProvId = assistantProviderMap.get(dentistEmail) ?? null;

    const patientRows = await prisma.patient.findMany({
      where: { Email: { in: patientEmails } },
      select: { PatNum: true, Email: true },
    });

    for (const patient of patientRows) {
      try {
        await patientWorkspaceService.updatePatientWorkspaceMeta(
          patient.PatNum.toString(),
          { preferredDentistId: dentistProvId, preferredHygienistId: hygienistProvId },
          seedUserId
        );
        linked++;
      } catch (err: any) {
        console.warn(`  Link failed for patient ${patient.Email}: ${err?.message}`);
        linkFailed++;
      }
    }
  }

  console.log(`\nAssistant seeding complete.`);
  console.log(`  Providers — Created: ${created}, Skipped: ${skipped}`);
  console.log(`  Patient links — Linked: ${linked}, Failed: ${linkFailed}`);
};

seedAssistants()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
