import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { tenantContextStorage } from '../config/tenant-context';

/**
 * Backfills existing rooms, appointments, and providers onto real branches
 * so GET /branches/analytics shows real, differentiated numbers instead of
 * zeros. Scoped only to Bright Smile Dental Group's two branches (Default
 * Clinic=1, Westside Branch=2) — Riverside Family Dentistry (clinic 3) is a
 * separate, unrelated practicegroup that never had this demo data, so it's
 * deliberately left alone rather than force-fitting data into it.
 *
 * Appointment.ClinicNum is derived from its own room's ClinicNum, so
 * appointment→branch stays internally consistent with room→branch rather
 * than being assigned arbitrarily.
 *
 * Idempotent — safe to re-run.
 */
async function main() {
  const DEFAULT_CLINIC = 1n;
  const WESTSIDE_CLINIC = 2n;

  console.log('Backfilling branches onto rooms, appointments, and providers...');

  // ── Rooms: split existing operatories across the two branches ─────────────
  const rooms = await prisma.operatory.findMany({ orderBy: { OperatoryNum: 'asc' } });
  for (let i = 0; i < rooms.length; i++) {
    const clinicNum = i % 2 === 0 ? DEFAULT_CLINIC : WESTSIDE_CLINIC;
    if (rooms[i].ClinicNum !== clinicNum) {
      await prisma.operatory.update({ where: { OperatoryNum: rooms[i].OperatoryNum }, data: { ClinicNum: clinicNum } });
    }
  }
  console.log(`Assigned ${rooms.length} rooms across clinics ${DEFAULT_CLINIC} and ${WESTSIDE_CLINIC}.`);

  // ── Appointments: derive ClinicNum from their own room ─────────────────────
  // The existing seed data never varied which room an appointment used (all
  // defaulted to the same one or two operatories), so a pure room-derived
  // backfill would leave every appointment on a single branch. Since this is
  // synthetic demo data (not real bookings), every 3rd appointment is also
  // moved onto a Westside room so both branches show real, differentiated
  // activity — the explicit goal of this backfill — rather than leaving one
  // branch at zero for an accident of the original seed script.
  const westsideRooms = rooms.filter((r) => r.ClinicNum === WESTSIDE_CLINIC);
  const roomClinicByOp = new Map(rooms.map((r) => [r.OperatoryNum.toString(), r.ClinicNum ?? DEFAULT_CLINIC]));
  const appointments = await prisma.appointment.findMany({ orderBy: { AptNum: 'asc' }, select: { AptNum: true, Op: true, ClinicNum: true } });
  let updatedAppointments = 0;
  for (let i = 0; i < appointments.length; i++) {
    const apt = appointments[i];
    const moveToWestside = westsideRooms.length > 0 && i % 3 === 0;
    const targetOp = moveToWestside ? westsideRooms[i % westsideRooms.length].OperatoryNum : apt.Op;
    const targetClinic = targetOp ? roomClinicByOp.get(targetOp.toString()) ?? DEFAULT_CLINIC : DEFAULT_CLINIC;
    if (apt.ClinicNum !== targetClinic || apt.Op !== targetOp) {
      await prisma.appointment.update({ where: { AptNum: apt.AptNum }, data: { Op: targetOp, ClinicNum: targetClinic } });
      updatedAppointments++;
    }
  }
  console.log(`Backfilled ClinicNum on ${updatedAppointments}/${appointments.length} appointments (from their room).`);

  // ── Providers: split real clinicians across both branches via providerclinic ─
  const providers = await prisma.provider.findMany({
    where: { IsHidden: 0, Abbr: { not: 'CSB' } }, // exclude the synthetic claim-biller provider
    orderBy: { ProvNum: 'asc' },
  });
  let assignedProviders = 0;
  for (let i = 0; i < providers.length; i++) {
    const clinicNum = i % 2 === 0 ? DEFAULT_CLINIC : WESTSIDE_CLINIC;
    const existing = await prisma.providerclinic.findFirst({
      where: { ProvNum: providers[i].ProvNum, ClinicNum: clinicNum },
    });
    if (!existing) {
      const nextId = await getNextId('providerclinic', 'ProviderClinicNum');
      await prisma.providerclinic.create({
        data: { ProviderClinicNum: nextId, ProvNum: providers[i].ProvNum, ClinicNum: clinicNum },
      });
      assignedProviders++;
    }
  }
  console.log(`Assigned ${assignedProviders} new provider↔clinic links across ${providers.length} providers.`);

  console.log('Done.');
}

// A trusted admin/backfill operation — no per-request tenant context exists
// for a standalone script, so RLS's WITH CHECK would otherwise reject every
// write of a non-null ClinicNum. Entering the '*' wildcard context here is
// the same bypass a true system Admin gets, not a way around RLS.
tenantContextStorage.run({ clinicIds: '*' }, () => main())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
