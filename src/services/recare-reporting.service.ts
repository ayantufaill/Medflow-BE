import { prisma } from '../config/db';
import { getPatientsMeta, getAppointmentsMeta } from '../utils/opendental-auth.util';
import { reportingClinicWhere } from '../utils/reporting-scope.util';
import { reportDate } from '../utils/reporting-fields.util';
import { calculateDueDate } from '../utils/recare-due-date.util';
import { mapAppointmentStatusFromDb } from '../utils/opendental-mappers.util';
import { getNextId } from '../utils/opendental-ids.util';

const EXAM_CODES = new Set(['D0120', 'D0140', 'D0145', 'D0150', 'D0160', 'D0170', 'D0180']);
const PROPHY_CODES = new Set(['D1110', 'D1120']);
const DEFAULT_RECALL_CODES = ['D1110', 'D1120', 'D0120', 'D0150', 'D0274', 'D1206', 'D4910'];
const parseNote = (value: string | null | undefined): Record<string, any> => {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { text: String(parsed) };
  } catch { return { text: value }; }
};
const noteText = (value: string | null | undefined): string | null => {
  if (!value?.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string') return parsed;
    return [parsed?.text, parsed?.note].find(v => typeof v === 'string' && v.trim()) ?? null;
  } catch { return value; }
};
const groupByPatient = <T extends { PatNum: bigint | null }>(rows: T[]) => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (row.PatNum == null) continue;
    const key = String(row.PatNum);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
};

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
  const [recalls, appointments, meta, procedures, recallTypes, config, commlogs, sentSms, receivedSms, emails] = await Promise.all([
    prisma.recall.findMany({ where: { PatNum: { in: ids } }, orderBy: [{ DateDue: 'asc' }, { RecallNum: 'asc' }] }),
    prisma.appointment.findMany({ where: { PatNum: { in: ids } }, orderBy: { AptDateTime: 'asc' } }),
    getPatientsMeta(ids),
    prisma.procedurelog.findMany({
      where: { PatNum: { in: ids }, ProcStatus: 2 },
      select: { PatNum: true, ProcDate: true, DateComplete: true, CodeNum: true, OldCode: true, procedurecode_procedurelog_CodeNumToprocedurecode: { select: { ProcCode: true } } },
    }),
    prisma.recalltype.findMany({ include: { recalltrigger: true } }),
    prisma.clinicalrecareconfig.findFirst(),
    prisma.commlog.findMany({ where: { PatNum: { in: ids }, CommDateTime: { lte: asOf } }, orderBy: { CommDateTime: 'desc' } }),
    prisma.smstomobile.findMany({ where: { PatNum: { in: ids }, SmsStatus: 1, DateTimeSent: { lte: asOf }, OR: [{ CustErrorText: null }, { CustErrorText: '' }] } }),
    prisma.smsfrommobile.findMany({ where: { PatNum: { in: ids }, DateTimeReceived: { lte: asOf } } }),
    prisma.emailmessage.findMany({ where: { PatNum: { in: ids }, SentOrReceived: 1, MsgDateTime: { lte: asOf }, OR: [{ FailReason: null }, { FailReason: '' }] } }),
  ]);
  const appointmentMeta = appointments.length ? await getAppointmentsMeta(appointments.map(a => a.AptNum)) : {};
  const byPatient = {
    recalls: groupByPatient(recalls), appointments: groupByPatient(appointments), procedures: groupByPatient(procedures),
    commlogs: groupByPatient(commlogs), sentSms: groupByPatient(sentSms), receivedSms: groupByPatient(receivedSms), emails: groupByPatient(emails),
  };
  const asOfDate = reportDate(asOf)!;
  const brokenSince = new Date(asOf); brokenSince.setUTCFullYear(brokenSince.getUTCFullYear() - 1);
  return patients.map(p => {
    const patientId = String(p.PatNum);
    const patientRecalls = byPatient.recalls.get(patientId) ?? [];
    const isEnabled = (r: typeof recalls[number]) => r.IsDisabled !== 1 && (!reportDate(r.DisableUntilDate) || reportDate(r.DisableUntilDate)! <= asOfDate);
    const active = patientRecalls.filter(r => isEnabled(r) && reportDate(r.DateDue));
    const recall = active[0];
    const pm = meta[patientId] ?? {};
    const flags = Array.isArray(pm.patientFlags) ? pm.patientFlags.filter(Boolean) : [];
    const flagged = flags.length > 0 || patientRecalls.some(r => r.IsDisabled === 1);
    const appts = byPatient.appointments.get(patientId) ?? [];
    const status = (a: typeof appointments[number]) => appointmentMeta[String(a.AptNum)]?.status ?? mapAppointmentStatusFromDb(a.AptStatus);
    const isRecare = (a: typeof appointments[number]) => {
      const am = appointmentMeta[String(a.AptNum)] ?? {};
      const visitType = am.customFields?.visitType ?? am.visitType;
      return visitType ? String(visitType).toLowerCase() === 'recare' : a.IsHygiene === 1;
    };
    const scheduled = appts.find(a => isRecare(a) && ['scheduled', 'confirmed', 'checked_in'].includes(status(a)) && reportDate(a.AptDateTime) && reportDate(a.AptDateTime)! >= asOfDate);
    const broken = appts.some(a => isRecare(a) && ['no_show', 'cancelled'].includes(status(a)) && a.AptDateTime && a.AptDateTime >= brokenSince && a.AptDateTime <= asOf);
    const completed = (byPatient.procedures.get(patientId) ?? []).map(proc => ({
      ...proc, code: (proc.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode || proc.OldCode || '').trim().toUpperCase(),
      date: reportDate(proc.ProcDate) ?? reportDate(proc.DateComplete),
    })).filter(proc => proc.date && proc.date <= asOfDate).sort((a, b) => b.date!.localeCompare(a.date!));
    const lastExam = completed.find(proc => EXAM_CODES.has(proc.code))?.date ?? null;
    const lastProphy = completed.find(proc => PROPHY_CODES.has(proc.code))?.date ?? null;
    const lastMaintenance = completed.find(proc => proc.code === 'D4910')?.date ?? null;

    // Reading reports must not create recalls or trigger the reminder/email sweep.
    // An explicit saved due date wins; calculate only when no enabled date exists.
    let due = reportDate(recall?.DateDue);
    if (!due && !patientRecalls.some(r => r.RecallTypeNum == null && !isEnabled(r))) {
      const candidates: string[] = [];
      const coveredCodes = new Set<string>();
      for (const type of recallTypes) {
        const codeNums = new Set(type.recalltrigger.filter(t => t.CodeNum != null).map(t => String(t.CodeNum)));
        const codes = (type.Procedures ?? '').toUpperCase().split(/[,\s;]+/).filter(Boolean);
        for (const code of codes) coveredCodes.add(code);
        const matching = completed.filter(proc => codeNums.has(String(proc.CodeNum)) || codes.includes(proc.code));
        for (const proc of matching) coveredCodes.add(proc.code);
        if (patientRecalls.some(r => r.RecallTypeNum === type.RecallTypeNum && !isEnabled(r))) continue;
        const last = matching[0];
        const interval = type.DefaultInterval ?? config?.IntervalMonths ?? 6;
        if (last?.date && interval > 0) candidates.push(calculateDueDate(last.date, interval, type.OffsetDays));
      }
      // Match the existing per-CDT due-date service's fallback for unconfigured codes.
      for (const code of DEFAULT_RECALL_CODES.filter(code => !coveredCodes.has(code))) {
        const last = completed.find(proc => proc.code === code);
        if (last?.date) candidates.push(calculateDueDate(last.date, config?.IntervalMonths ?? 6));
      }
      due = candidates.sort()[0] ?? null;
    }

    const patientComms = byPatient.commlogs.get(patientId) ?? [];
    const noteRecall = recall ?? patientRecalls.find(isEnabled);
    const recallNote = parseNote(noteRecall?.Note);
    const communicationTimes: Date[] = [];
    const addContact = (date: Date | string | null | undefined) => {
      if (!reportDate(date)) return;
      const timestamp = new Date(date!);
      if (timestamp <= asOf) communicationTimes.push(timestamp);
    };
    const linkedSmsLogs = new Set((byPatient.receivedSms.get(patientId) ?? []).map(s => String(s.CommlogNum)));
    for (const comm of patientComms) {
      const data = parseNote(comm.Note);
      const isInternal = data.noteType || data.isProgressNote || data.formId || data.formType || data.templateId;
      if (!linkedSmsLogs.has(String(comm.CommlogNum)) &&
        (data.type === 'portal_message' || (!isInternal && comm.Mode_ != null && comm.Mode_ > 0 && [1, 2].includes(comm.SentOrReceived!)))) {
        addContact(comm.CommDateTime);
      }
    }
    for (const sms of byPatient.sentSms.get(patientId) ?? []) addContact(sms.DateTimeSent);
    for (const sms of byPatient.receivedSms.get(patientId) ?? []) addContact(sms.DateTimeReceived);
    for (const email of byPatient.emails.get(patientId) ?? []) addContact(email.MsgDateTime);
    const reminderTimes = new Set(patientRecalls.map(r => parseNote(r.Note).lastReminderSentAt).filter((value): value is string => typeof value === 'string'));
    for (const reminder of reminderTimes) {
      if (!communicationTimes.some(t => t.getTime() === new Date(reminder).getTime())) addContact(reminder);
    }
    communicationTimes.sort((a, b) => b.getTime() - a.getTime());
    // Only explicit follow-up information is displayed, never inferred from an unrelated appointment.
    const followUpNote = patientComms.map(comm => parseNote(comm.Note)).find(note =>
      typeof note.requiresFollowUp === 'boolean' && !note.isArchived);
    const followUp = reportDate(recallNote.followUpDate ?? recallNote.followUp) ??
      (followUpNote?.requiresFollowUp ? reportDate(followUpNote.followUpDate) : null);
    const categoryKey = classifyRecare(due, flagged, Boolean(scheduled), broken, asOf);
    const birth = reportDate(p.Birthdate);
    const age = birth ? asOf.getUTCFullYear() - Number(birth.slice(0, 4)) - (reportDate(asOf)!.slice(5) < birth.slice(5) ? 1 : 0) : null;
    return {
      id: String(p.PatNum), patient: [p.FName, p.LName].filter(Boolean).join(' '),
      categoryKey, category: recareCategories[categoryKey], asOf: reportDate(asOf),
      flags: flagged ? flags.map((f: any) => typeof f === 'string' ? f : f.name ?? f.label ?? f.id).filter(Boolean).join(', ') || 'Recare disabled' : '',
      age, contact: p.WirelessPhone || p.HmPhone || p.WkPhone || null, recallDate: due,
      lastExam, lastProphy, lastMaintenance, lastComm: reportDate(communicationTimes[0]),
      note: noteText(noteRecall?.Note),
      contactAgain: reportDate(recallNote.contactAgainDate ?? recallNote.contactAgain) ?? (recallNote.contactAgain ? String(recallNote.contactAgain) : null),
      followUp: reportDate(recallNote.followUpDate ?? recallNote.followUp) ??
        (recallNote.followUp ? String(recallNote.followUp) : null) ??
        (followUpNote?.requiresFollowUp ? reportDate(followUpNote.followUpDate) : null),
      apptDate: reportDate(scheduled?.AptDateTime), contactCount: communicationTimes.length,
      dentistId: p.PriProv?.toString() ?? pm.preferredDentistId ?? null, hygienistId: p.SecProv?.toString() ?? pm.preferredHygienistId ?? null,
    };
  });
}
export function countRecareCategories(rows: { categoryKey: RecareCategory }[]) {
  const counts = Object.fromEntries(Object.keys(recareCategories).map(key => [key, 0])) as Record<RecareCategory, number>;
  for (const row of rows) counts[row.categoryKey]++;
  return counts;
}

export async function resetRecarePatient(
  patientId: string | number | bigint,
  data: { note?: string; contactAgain?: string; followUp?: string } = {}
) {
  const patNum = BigInt(patientId);

  const existingRecall =
    (await prisma.recall.findFirst({
      where: { PatNum: patNum, IsDisabled: 0 },
      orderBy: { DateDue: 'desc' },
    })) ||
    (await prisma.recall.findFirst({
      where: { PatNum: patNum },
      orderBy: { DateDue: 'desc' },
    }));

  const noteMeta = parseNote(existingRecall?.Note);
  const updatedNote = JSON.stringify({
    ...noteMeta,
    text: data.note !== undefined ? data.note : (noteMeta.text ?? ''),
    note: data.note !== undefined ? data.note : (noteMeta.note ?? ''),
    contactAgain: data.contactAgain !== undefined ? data.contactAgain : (noteMeta.contactAgain ?? ''),
    contactAgainDate: data.contactAgain !== undefined ? data.contactAgain : (noteMeta.contactAgainDate ?? ''),
    followUp: data.followUp !== undefined ? data.followUp : (noteMeta.followUp ?? ''),
    followUpDate: data.followUp !== undefined ? data.followUp : (noteMeta.followUpDate ?? ''),
    lastReminderSentAt: null,
    lastResetAt: new Date().toISOString(),
  });

  if (existingRecall) {
    const updated = await prisma.recall.update({
      where: { RecallNum: existingRecall.RecallNum },
      data: {
        Note: updatedNote,
        DateTStamp: new Date(),
      },
    });
    return {
      success: true,
      recallNum: String(updated.RecallNum),
      patientId: String(patNum),
      note: data.note,
      contactAgain: data.contactAgain,
      followUp: data.followUp,
    };
  } else {
    const nextId = await getNextId('recall', 'RecallNum');
    const created = await prisma.recall.create({
      data: {
        RecallNum: nextId,
        PatNum: patNum,
        DateDue: new Date(),
        DateDueCalc: new Date(),
        RecallInterval: 180,
        IsDisabled: 0,
        Note: updatedNote,
        DateTStamp: new Date(),
      },
    });
    return {
      success: true,
      recallNum: String(created.RecallNum),
      patientId: String(patNum),
      note: data.note,
      contactAgain: data.contactAgain,
      followUp: data.followUp,
    };
  }
}
