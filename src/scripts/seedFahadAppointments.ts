import { prisma } from '../config/db.js';
import { appointmentService } from '../services/appointment.service.js';

const getNextNWeekdays = (n: number): Date[] => {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.length < n) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const APPOINTMENTS = [
  { providerNum: '1', typeNum: '1', start: '09:00', end: '10:00', complaint: 'Routine consultation — general oral health review', status: 'scheduled' },
  { providerNum: '2', typeNum: '2', start: '10:00', end: '11:00', complaint: 'Adult prophylaxis and bitewing X-rays', status: 'confirmed' },
  { providerNum: '3', typeNum: '3', start: '11:00', end: '12:00', complaint: 'Follow-up — post-extraction site check', status: 'scheduled' },
  { providerNum: '4', typeNum: '2', start: '13:00', end: '14:00', complaint: 'Routine cleaning and oral hygiene review', status: 'confirmed' },
  { providerNum: '5', typeNum: '1', start: '14:00', end: '15:00', complaint: 'New patient comprehensive exam and treatment planning', status: 'scheduled' },
];

const seedFahadAppointments = async () => {
  const adminUser = await prisma.userod.findFirst({ orderBy: { UserNum: 'asc' } });
  if (!adminUser) { console.error('No admin user found.'); return; }
  const userId = adminUser.UserNum.toString();

  const days = getNextNWeekdays(5);
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < 5; i++) {
    const day = days[i]!;
    const appt = APPOINTMENTS[i]!;
    const dateLabel = day.toISOString().split('T')[0];

    try {
      await appointmentService.createAppointment(
        {
          patientId: '1',
          providerId: appt.providerNum,
          appointmentTypeId: appt.typeNum,
          appointmentDate: day,
          startTime: appt.start,
          endTime: appt.end,
          durationMinutes: 60,
          chiefComplaint: appt.complaint,
          status: appt.status,
          insuranceVerified: false,
          reminderSent: appt.status === 'confirmed',
        },
        userId,
      );
      console.log(`  Created: ${dateLabel} ${appt.start} — Provider ${appt.providerNum} (${appt.status})`);
      created++;
    } catch (err: any) {
      if (err?.message?.includes('conflicts') || err?.message?.includes('already booked')) {
        console.log(`  Skipped (conflict): ${dateLabel} ${appt.start}`);
        skipped++;
      } else {
        console.warn(`  Failed: ${dateLabel} ${appt.start} — ${err?.message}`);
      }
    }
  }

  console.log(`\nDone. Created: ${created}  |  Skipped: ${skipped}`);
};

seedFahadAppointments()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
