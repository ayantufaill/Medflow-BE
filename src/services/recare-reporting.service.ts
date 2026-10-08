import { prisma } from '../config/db';
import { getPatientsMeta } from '../utils/opendental-auth.util';
import { reportingClinicWhere } from '../utils/reporting-scope.util';
import { reportDate } from '../utils/reporting-fields.util';

export const recareCategories = {
  onTimeNoPreAppt: 'On-Time No Pre-appt', onTimePreAppt: 'On-Time Pre-appt',
  noRecare: 'No Recare', flaggedNoRecare: 'Flagged No-Recare',
  late12mAppt: 'Late 12+ months Appointed', late12mBroken: 'Late 12+ months Broken Appointment', late12mNoAppt: 'Late 12+ months No Appointment',
  lateUnder12mAppt: 'Late <12 months Appointed', lateUnder12mBroken: 'Late <12 months Broken Appointment', lateUnder12mNoAppt: 'Late <12 months No Appointment',
};
export type RecareCategory = keyof typeof recareCategories;
export function classifyRecare(due: string | null, flagged: boolean, scheduled: boolean, broken: boolean, asOf: Date): RecareCategory {
  if (!due) return flagged ? 'flaggedNoRecare' : 'noRecare';
  if (due >= reportDate(asOf)!) return scheduled ? 'onTimePreAppt' : 'onTimeNoPreAppt';
  const yearAgo = new Date(asOf); yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  const prefix = due <= reportDate(yearAgo)! ? 'late12m' : 'lateUnder12m';
  return `${prefix}${scheduled ? 'Appt' : broken ? 'Broken' : 'NoAppt'}` as RecareCategory;
}
export async function recarePatientRows(options: { asOf?: Date; clinicIds?: bigint[]; providerIds?: bigint[] } = {}) {
  const asOf = options.asOf ?? new Date();
  const patients = await prisma.patient.findMany({
    where: {
      PatStatus: 0,
      ...(options.clinicIds ? { ClinicNum: { in: options.clinicIds } } : reportingClinicWhere()),
      ...(options.providerIds !== undefined ? { OR: [{ PriProv: { in: options.providerIds } }, { SecProv: { in: options.providerIds } }] } : {}),
    }, orderBy: { PatNum: 'asc' },
  });
  if (!patients.length) return [];
  const ids = patients.map(p => p.PatNum);
  const [recalls, appointments, meta] = await Promise.all([
    prisma.recall.findMany({ where: { PatNum: { in: ids } }, orderBy: [{ DateDue: 'asc' }, { RecallNum: 'asc' }] }),
    prisma.appointment.findMany({ where: { PatNum: { in: ids }, IsHygiene: 1, AptStatus: { in: [1, 3, 4] } }, orderBy: { AptDateTime: 'asc' } }),
    getPatientsMeta(ids),
  ]);
  const brokenSince = new Date(asOf); brokenSince.setUTCFullYear(brokenSince.getUTCFullYear() - 1);
  return patients.map(p => {
    const patientRecalls = recalls.filter(r => r.PatNum === p.PatNum);
    const active = patientRecalls.filter(r => r.IsDisabled === 0 && (!reportDate(r.DisableUntilDate) || reportDate(r.DisableUntilDate)! <= reportDate(asOf)!) && reportDate(r.DateDue));
    const recall = active[0];
    const pm = meta[String(p.PatNum)] ?? {};
    const flags = Array.isArray(pm.patientFlags) ? pm.patientFlags.filter(Boolean) : [];
    const flagged = flags.length > 0 || patientRecalls.some(r => r.IsDisabled === 1);
    const appts = appointments.filter(a => a.PatNum === p.PatNum);
    const scheduled = appts.find(a => a.AptStatus === 1 && a.AptDateTime && reportDate(a.AptDateTime)! >= reportDate(asOf)!);
    const broken = appts.some(a => [3, 4].includes(a.AptStatus!) && a.AptDateTime && a.AptDateTime >= brokenSince && a.AptDateTime <= asOf);
    const due = reportDate(recall?.DateDue);
    const categoryKey = classifyRecare(due, flagged, Boolean(scheduled), broken, asOf);
    const birth = reportDate(p.Birthdate);
    const age = birth ? asOf.getUTCFullYear() - Number(birth.slice(0, 4)) - (reportDate(asOf)!.slice(5) < birth.slice(5) ? 1 : 0) : null;
    return {
      id: String(p.PatNum), patient: [p.FName, p.LName].filter(Boolean).join(' '),
      categoryKey, category: recareCategories[categoryKey], asOf: reportDate(asOf),
      flags: flagged ? flags.map((f: any) => typeof f === 'string' ? f : f.name ?? f.label ?? f.id).filter(Boolean).join(', ') || 'Recare disabled' : '',
      age, contact: p.WirelessPhone || p.HmPhone || p.WkPhone || null, recallDate: due,
      lastExam: null, lastProphy: null, lastMaintenance: null, lastComm: null,
      note: recall?.Note ?? null, contactAgain: null, followUp: null,
      apptDate: reportDate(scheduled?.AptDateTime), contactCount: null,
      dentistId: p.PriProv?.toString() ?? null, hygienistId: p.SecProv?.toString() ?? null,
    };
  });
}
export function countRecareCategories(rows: { categoryKey: RecareCategory }[]) {
  const counts = Object.fromEntries(Object.keys(recareCategories).map(key => [key, 0])) as Record<RecareCategory, number>;
  for (const row of rows) counts[row.categoryKey]++;
  return counts;
}
