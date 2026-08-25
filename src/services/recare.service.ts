import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { emailService } from './email.service';

const REMINDER_COOLDOWN_DAYS = 30;

const parseNote = (value?: string | null): Record<string, any> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export interface RecareSweepResult {
  autoReminderEnabled: boolean;
  intervalMonths: number;
  patientsChecked: number;
  duePatients: number;
  remindersSent: number;
  skipped: number;
}

/**
 * Recare (recall) reminders: patients whose last completed visit plus the
 * configured interval (clinicalrecareconfig) has passed. Named "reminder",
 * not "auto-book" — RecareConfiguration.jsx's toggle is literally called
 * autoReminder, so a human still schedules the actual appointment; this
 * sweep just tells the patient (and, going forward, bootstraps real rows
 * into OpenDental's native `recall` table) that they're due, rather than
 * autonomously picking a provider/time slot on their behalf.
 */
export class RecareService {
  async runDueRecareSweep(): Promise<RecareSweepResult> {
    const config = await prisma.clinicalrecareconfig.findFirst();
    const intervalMonths = config?.IntervalMonths ?? 6;
    const autoReminderEnabled = config?.AutoReminder ?? true;

    if (!autoReminderEnabled) {
      return {
        autoReminderEnabled: false,
        intervalMonths,
        patientsChecked: 0,
        duePatients: 0,
        remindersSent: 0,
        skipped: 0,
      };
    }

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - intervalMonths);

    // Active patients with an email on file — a reminder needs somewhere to go.
    const patients = await prisma.patient.findMany({
      where: { PatStatus: { not: 2 }, Email: { not: null } },
      select: { PatNum: true, Email: true, FName: true, DateFirstVisit: true },
    });

    const lastCompletedByPatient = await prisma.appointment.groupBy({
      by: ['PatNum'],
      where: { AptStatus: 2, PatNum: { in: patients.map((p) => p.PatNum) } },
      _max: { AptDateTime: true },
    });
    const lastVisitMap = new Map(
      lastCompletedByPatient.map((r) => [r.PatNum?.toString(), r._max.AptDateTime])
    );

    const cooldownCutoff = new Date();
    cooldownCutoff.setDate(cooldownCutoff.getDate() - REMINDER_COOLDOWN_DAYS);

    let duePatients = 0;
    let remindersSent = 0;
    let skipped = 0;

    for (const patient of patients) {
      const patNumStr = patient.PatNum.toString();
      const lastVisit = lastVisitMap.get(patNumStr) ?? patient.DateFirstVisit ?? null;
      if (!lastVisit || new Date(lastVisit) > cutoff) {
        continue; // no visit history to base an interval on, or not due yet
      }

      duePatients++;

      const existingRecall = await prisma.recall.findFirst({
        where: { PatNum: patient.PatNum, IsDisabled: 0 },
        orderBy: { DateDue: 'desc' },
      });

      const noteMeta = parseNote(existingRecall?.Note);
      const lastReminderSentAt = noteMeta.lastReminderSentAt ? new Date(noteMeta.lastReminderSentAt) : null;
      if (lastReminderSentAt && lastReminderSentAt > cooldownCutoff) {
        skipped++;
        continue;
      }

      try {
        await emailService.sendBulkEmail(
          patient.Email!,
          "You're due for your dental check-up",
          `Hi ${patient.FName ?? ''}, our records show it's been a while since your last visit. ` +
            `Please call our office or use the patient portal to schedule your next check-up.`
        );
        remindersSent++;
      } catch (error) {
        console.error(`Recare reminder failed for patient ${patNumStr}:`, error);
        skipped++;
        continue;
      }

      // Bootstraps/refreshes a real `recall` row so dashboard-metrics' existing
      // hygiene-potential reporting (which already reads prisma.recall) has
      // real due-date data instead of the empty table it sees today.
      const dueDate = new Date(lastVisit);
      dueDate.setMonth(dueDate.getMonth() + intervalMonths);
      const nextNote = JSON.stringify({ ...noteMeta, lastReminderSentAt: new Date().toISOString() });

      if (existingRecall) {
        await prisma.recall.update({
          where: { RecallNum: existingRecall.RecallNum },
          data: { DateDue: dueDate, DateDueCalc: dueDate, DatePrevious: lastVisit, Note: nextNote, DateTStamp: new Date() },
        });
      } else {
        const nextId = await getNextId('recall', 'RecallNum');
        await prisma.recall.create({
          data: {
            RecallNum: nextId,
            PatNum: patient.PatNum,
            DateDue: dueDate,
            DateDueCalc: dueDate,
            DatePrevious: lastVisit,
            RecallInterval: intervalMonths * 30,
            IsDisabled: 0,
            Note: nextNote,
            DateTStamp: new Date(),
          },
        });
      }
    }

    return {
      autoReminderEnabled,
      intervalMonths,
      patientsChecked: patients.length,
      duePatients,
      remindersSent,
      skipped,
    };
  }
}

export const recareService = new RecareService();
