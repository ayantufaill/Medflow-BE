import { prisma } from '../config/db';
import { appointmentService } from '../services/appointment.service';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns a Date for a given YYYY-MM-DD string at midnight UTC-local */
const d = (iso: string) => new Date(iso);

/** Next weekday (Mon–Fri) on or after the given date */
const nextWeekday = (base: Date, offset: number): Date => {
  const dt = new Date(base);
  dt.setDate(dt.getDate() + offset);
  // Skip weekends
  while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
  return dt;
};

/** Format Date as YYYY-MM-DD */
const fmt = (dt: Date) => dt.toISOString().split('T')[0]!;

// ---------------------------------------------------------------------------
// Time slot helpers
// ---------------------------------------------------------------------------

const SLOTS = [
  { start: '09:00', end: '10:00', duration: 60 },
  { start: '10:00', end: '11:00', duration: 60 },
  { start: '11:00', end: '12:00', duration: 60 },
  { start: '13:00', end: '14:00', duration: 60 },
  { start: '14:00', end: '15:00', duration: 60 },
] as const;

// ---------------------------------------------------------------------------
// Patient emails — must match seedPatients.ts exactly
// ---------------------------------------------------------------------------

const PATIENT_EMAILS = [
  'james.harrison@example.com',    // 0  → Provider 0 (Mitchell)
  'maria.gonzalez@example.com',    // 1  → Provider 0
  'david.kim@example.com',         // 2  → Provider 0
  'patricia.williams@example.com', // 3  → Provider 0
  'michael.thompson@example.com',  // 4  → Provider 0

  'jennifer.martinez@example.com', // 5  → Provider 1 (Patel)
  'robert.johnson@example.com',    // 6  → Provider 1
  'ashley.brown@example.com',      // 7  → Provider 1
  'christopher.davis@example.com', // 8  → Provider 1
  'amanda.wilson@example.com',     // 9  → Provider 1

  'matthew.anderson@example.com',  // 10 → Provider 2 (Chen)
  'sophia.taylor@example.com',     // 11 → Provider 2
  'daniel.jackson@example.com',    // 12 → Provider 2
  'emily.white@example.com',       // 13 → Provider 2
  'joshua.harris@example.com',     // 14 → Provider 2

  'olivia.martin@example.com',     // 15 → Provider 3 (Torres)
  'andrew.garcia@example.com',     // 16 → Provider 3
  'samantha.lee@example.com',      // 17 → Provider 3
  'kevin.robinson@example.com',    // 18 → Provider 3
  'lauren.clark@example.com',      // 19 → Provider 3

  'tyler.lewis@example.com',       // 20 → Provider 4 (Kim)
  'natalie.walker@example.com',    // 21 → Provider 4
  'brandon.hall@example.com',      // 22 → Provider 4
  'rachel.young@example.com',      // 23 → Provider 4
  'jason.allen@example.com',       // 24 → Provider 4
];

// ---------------------------------------------------------------------------
// Appointment clusters
// Each cluster is a Mon–Fri week block. On each day, all 5 providers each
// see one patient, giving 5 appointments per day × 5 days = 25 per cluster.
// Patients are staggered across days so no provider has two patients the
// same day within a cluster.
//
//   Day 0 (Mon): patient indices 0,5,10,15,20
//   Day 1 (Tue): patient indices 1,6,11,16,21
//   Day 2 (Wed): patient indices 2,7,12,17,22
//   Day 3 (Thu): patient indices 3,8,13,18,23
//   Day 4 (Fri): patient indices 4,9,14,19,24
//
// The time slot is picked by the patient's position within their provider
// group (0–4 → slots 0–4) so each patient always gets the same time block.
// ---------------------------------------------------------------------------

const CLUSTERS: Array<{
  weekMonday: string;        // ISO date of the Monday of that week
  typeIndex: number;         // 0=Consultation 1=Cleaning 2=Follow-up
  status: string;
  chiefComplaints: string[]; // one per day-of-week (index 0–4)
}> = [
  // ── Past 1 ── Dec 08, 2025  (Consultation / completed)
  {
    weekMonday: '2025-12-08',
    typeIndex: 0,
    status: 'completed',
    chiefComplaints: [
      'New patient exam and full mouth X-rays',
      'Initial consultation — chief complaint evaluation',
      'New patient comprehensive oral exam',
      'Consultation for persistent tooth sensitivity',
      'Full mouth exam and treatment planning',
    ],
  },
  // ── Past 2 ── Jan 12, 2026  (Cleaning / completed)
  {
    weekMonday: '2026-01-12',
    typeIndex: 1,
    status: 'completed',
    chiefComplaints: [
      'Routine prophylaxis and periodontal charting',
      'Adult cleaning with fluoride treatment',
      'Prophy and bitewing X-rays',
      'Routine cleaning and oral hygiene review',
      'Prophylaxis and polish',
    ],
  },
  // ── Past 3 ── Feb 16, 2026  (Follow-up / completed)
  {
    weekMonday: '2026-02-16',
    typeIndex: 2,
    status: 'completed',
    chiefComplaints: [
      'Post-treatment check and treatment plan review',
      'Follow-up after cleaning — gum assessment',
      'Review of treatment plan — restorative options',
      'Post-whitening sensitivity check',
      'Six-month recall exam',
    ],
  },
  // ── Upcoming 1 ── Mar 30, 2026  (Cleaning / confirmed)
  {
    weekMonday: '2026-03-30',
    typeIndex: 1,
    status: 'confirmed',
    chiefComplaints: [
      'Scheduled adult cleaning and exam',
      'Prophy appointment — due for 6-month cleaning',
      'Cleaning and updated bitewing X-rays',
      'Routine cleaning and gum health check',
      'Prophylaxis and fluoride varnish',
    ],
  },
  // ── Upcoming 2 ── Apr 27, 2026  (Follow-up / scheduled)
  {
    weekMonday: '2026-04-27',
    typeIndex: 2,
    status: 'scheduled',
    chiefComplaints: [
      'Follow-up — crown prep evaluation',
      'Three-month periodontal maintenance recall',
      'Post-extraction site check',
      'Six-month recall exam',
      'Orthodontic retainer adjustment follow-up',
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

const seedAppointments = async () => {
  const adminUser = await prisma.userod.findFirst({ orderBy: { UserNum: 'asc' } });
  if (!adminUser) {
    console.error('No admin user found — run seed:users first.');
    return;
  }
  const seedUserId = adminUser.UserNum.toString();

  // Load patients by email → { email: patientId }
  const patientRows = await prisma.patient.findMany({
    where: { Email: { in: PATIENT_EMAILS } },
    select: { PatNum: true, Email: true },
  });
  const patientMap = new Map(patientRows.map((p) => [p.Email!, p.PatNum.toString()]));

  const missingPatients = PATIENT_EMAILS.filter((e) => !patientMap.has(e));
  if (missingPatients.length) {
    console.error('Missing patients (run seed:patients first):', missingPatients);
    return;
  }

  // Load providers ordered by creation (matches our seed order)
  const providers = await prisma.provider.findMany({
    where: { IsHidden: 0 },
    orderBy: { ProvNum: 'asc' },
    select: { ProvNum: true, FName: true, LName: true },
  });

  if (providers.length < 5) {
    console.error(`Need 5 providers but only found ${providers.length} — run seed:providers first.`);
    return;
  }

  // Load appointment types ordered by creation
  const apptTypes = await prisma.appointmenttype.findMany({
    where: { IsHidden: 0 },
    orderBy: { AppointmentTypeNum: 'asc' },
    select: { AppointmentTypeNum: true, AppointmentTypeName: true },
  });

  if (apptTypes.length < 3) {
    console.error(`Need at least 3 appointment types but found ${apptTypes.length} — run seed:appointment-types first.`);
    return;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const cluster of CLUSTERS) {
    const mondayDate = d(cluster.weekMonday);
    const apptTypeId = (apptTypes[cluster.typeIndex] ?? apptTypes[0]!).AppointmentTypeNum.toString();

    // 5 days in the cluster week (Mon=0 … Fri=4)
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const appointmentDate = nextWeekday(mondayDate, dayIndex);
      const complaint = cluster.chiefComplaints[dayIndex] ?? 'Routine dental visit';

      // On this day: 5 patients (one per provider), patient indices = dayIndex, dayIndex+5, +10, +15, +20
      for (let providerIndex = 0; providerIndex < 5; providerIndex++) {
        const patientArrayIndex = dayIndex + providerIndex * 5;
        const email = PATIENT_EMAILS[patientArrayIndex]!;
        const patientId = patientMap.get(email)!;
        const providerId = providers[providerIndex]!.ProvNum.toString();
        const slot = SLOTS[providerIndex]!; // each provider gets a distinct time on the same day

        try {
          await appointmentService.createAppointment(
            {
              patientId,
              providerId,
              appointmentTypeId: apptTypeId,
              appointmentDate,
              startTime: slot.start,
              endTime: slot.end,
              durationMinutes: slot.duration,
              chiefComplaint: complaint,
              status: cluster.status,
              insuranceVerified: cluster.status === 'completed',
              reminderSent: cluster.status !== 'scheduled',
            },
            seedUserId
          );
          created++;
        } catch (err: any) {
          if (err?.message?.includes('conflicts') || err?.message?.includes('already booked')) {
            skipped++;
          } else {
            console.warn(
              `  Failed [${fmt(appointmentDate)} ${slot.start} P${providerIndex + 1}]: ${err?.message}`
            );
            failed++;
          }
        }
      }
    }

    console.log(`  Cluster ${cluster.weekMonday} (${cluster.status}) — done`);
  }

  console.log(`\nAppointment seeding complete.`);
  console.log(`  Created: ${created}  |  Skipped (conflict): ${skipped}  |  Failed: ${failed}`);
  console.log(`\nCalendar coverage:`);
  console.log(`  Past:     Dec 08–12 2025 · Jan 12–16 2026 · Feb 16–20 2026`);
  console.log(`  Upcoming: Mar 30–Apr 03 2026 · Apr 27–May 01 2026`);
};

seedAppointments()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
