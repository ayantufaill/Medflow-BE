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

export interface RecareDueDateResult {
  code: string;
  procedureName?: string;
  recallTypeNum?: string | null;
  recallTypeName?: string | null;
  intervalMonths: number;
  offsetDays: number;
  lastCompletedDate: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  isNeverCompleted: boolean;
  sourceAppointmentId?: string | null;
}

export interface PatientRecareDueDatesResult {
  patientId: string;
  recareDueDates: Record<string, RecareDueDateResult>;
}

export interface RecareSweepResult {
  autoReminderEnabled: boolean;
  intervalMonths: number;
  patientsChecked: number;
  duePatients: number;
  remindersSent: number;
  skipped: number;
}

/**
 * Calculates due date given a base date (last completed date),
 * an interval in months, and optional offset days (e.g. Oryx +1 day rule).
 */
export function calculateDueDate(
  baseDate: Date | string,
  intervalMonths: number,
  offsetDays: number = 0
): string {
  const d = new Date(baseDate);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  const targetMonthIndex = month + intervalMonths;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

  const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  const targetDate = new Date(Date.UTC(targetYear, normalizedMonth, clampedDay));
  if (offsetDays) {
    targetDate.setUTCDate(targetDate.getUTCDate() + offsetDays);
  }

  return targetDate.toISOString().slice(0, 10);
}

/**
 * Recare (recall) service implementing Oryx-style per-CDT due date calculation.
 * Due dates are calculated from the patient's last completed procedure matching the CDT code
 * (or its linked recall trigger group) + configured recall interval (months) + offset days.
 */
export class RecareService {
  /**
   * Get calculated recare due date for a specific patient and CDT code.
   */
  async getRecareDueDate(
    patientId: bigint | string | number,
    code: string
  ): Promise<RecareDueDateResult> {
    const cleanCode = code.trim().toUpperCase();
    const patNum = BigInt(patientId);

    // 1. Look up procedure code details
    const procCode = await prisma.procedurecode.findFirst({
      where: { ProcCode: cleanCode },
    });

    // 2. Find recall type and trigger mappings
    let recallType: any = null;
    let triggerCodeNums: bigint[] = [];

    if (procCode) {
      const trigger = await prisma.recalltrigger.findFirst({
        where: { CodeNum: procCode.CodeNum },
        include: { recalltype: true },
      });
      if (trigger?.recalltype) {
        recallType = trigger.recalltype;
      }
    }

    if (!recallType) {
      recallType = await prisma.recalltype.findFirst({
        where: {
          OR: [
            { Procedures: { contains: cleanCode } },
            { Description: { contains: cleanCode, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (recallType) {
      const triggersForType = await prisma.recalltrigger.findMany({
        where: { RecallTypeNum: recallType.RecallTypeNum },
        select: { CodeNum: true },
      });
      triggerCodeNums = triggersForType
        .map((t) => t.CodeNum)
        .filter((c): c is bigint => c !== null);
    }

    if (procCode?.CodeNum && !triggerCodeNums.includes(procCode.CodeNum)) {
      triggerCodeNums.push(procCode.CodeNum);
    }

    const intervalMonths = recallType?.DefaultInterval ?? 6;
    const offsetDays = 0;
    const recallTypeNum = recallType ? recallType.RecallTypeNum.toString() : null;
    const recallTypeName = recallType?.Description ?? null;

    // 3. Find the patient's latest completed procedure
    const orConditions: any[] = [];
    if (triggerCodeNums.length > 0) {
      orConditions.push({ CodeNum: { in: triggerCodeNums } });
    }
    orConditions.push({ OldCode: cleanCode });

    const lastCompletedProc = await prisma.procedurelog.findFirst({
      where: {
        PatNum: patNum,
        ProcStatus: 2, // 2 = Completed in OpenDental/Medflow
        OR: orConditions,
      },
      orderBy: [{ ProcDate: 'desc' }, { DateComplete: 'desc' }],
      select: {
        ProcDate: true,
        DateComplete: true,
        CodeNum: true,
        OldCode: true,
        AptNum: true,
      },
    });

    const rawDate = lastCompletedProc?.ProcDate ?? lastCompletedProc?.DateComplete ?? null;

    if (!rawDate) {
      return {
        code: cleanCode,
        procedureName: procCode?.Descript ?? procCode?.AbbrDesc ?? cleanCode,
        recallTypeNum,
        recallTypeName,
        intervalMonths,
        offsetDays,
        lastCompletedDate: null,
        dueDate: null,
        isOverdue: false,
        isNeverCompleted: true,
        sourceAppointmentId: null,
      };
    }

    const lastCompletedDate = (
      rawDate instanceof Date ? rawDate.toISOString() : String(rawDate)
    ).slice(0, 10);
    const dueDate = calculateDueDate(lastCompletedDate, intervalMonths, offsetDays);
    const todayStr = new Date().toISOString().slice(0, 10);
    const isOverdue = dueDate < todayStr;

    return {
      code: cleanCode,
      procedureName: procCode?.Descript ?? procCode?.AbbrDesc ?? cleanCode,
      recallTypeNum,
      recallTypeName,
      intervalMonths,
      offsetDays,
      lastCompletedDate,
      dueDate,
      isOverdue,
      isNeverCompleted: false,
      sourceAppointmentId: lastCompletedProc?.AptNum ? lastCompletedProc.AptNum.toString() : null,
    };
  }

  /**
   * Calculate recare due dates for multiple CDT procedures for a patient.
   * If filterProcedures is omitted, evaluates all seeded/configured recare CDT codes.
   */
  async calculateRecareDueDates(
    patientId: bigint | string | number,
    filterProcedures?: string[]
  ): Promise<PatientRecareDueDatesResult> {
    let codesToCheck: string[] = [];

    if (filterProcedures && filterProcedures.length > 0) {
      codesToCheck = Array.from(
        new Set(filterProcedures.map((c) => c.trim().toUpperCase()).filter(Boolean))
      );
    } else {
      const triggers = await prisma.recalltrigger.findMany({
        include: { procedurecode: true },
      });
      const triggerCodes = triggers
        .map((t) => t.procedurecode?.ProcCode)
        .filter((c): c is string => Boolean(c));

      const defaultCodes = ['D1110', 'D1120', 'D0120', 'D0150', 'D0274', 'D1206', 'D4910'];
      codesToCheck = Array.from(new Set([...defaultCodes, ...triggerCodes]));
    }

    const recareDueDates: Record<string, RecareDueDateResult> = {};
    for (const code of codesToCheck) {
      recareDueDates[code] = await this.getRecareDueDate(patientId, code);
    }

    return {
      patientId: patientId.toString(),
      recareDueDates,
    };
  }

  /**
   * Recare reminders sweep: checks active patients against their CDT recall intervals,
   * updates native OpenDental `recall` table rows, and sends email reminders if due and cooldown elapsed.
   */
  async runDueRecareSweep(): Promise<RecareSweepResult> {
    const config = await prisma.clinicalrecareconfig.findFirst();
    const defaultIntervalMonths = config?.IntervalMonths ?? 6;
    const autoReminderEnabled = config?.AutoReminder ?? true;

    if (!autoReminderEnabled) {
      return {
        autoReminderEnabled: false,
        intervalMonths: defaultIntervalMonths,
        patientsChecked: 0,
        duePatients: 0,
        remindersSent: 0,
        skipped: 0,
      };
    }

    // Fetch all active recall types with their triggers
    const recallTypes = await prisma.recalltype.findMany({
      include: {
        recalltrigger: {
          include: { procedurecode: true },
        },
      },
    });

    // Active patients with an email on file
    const patients = await prisma.patient.findMany({
      where: { PatStatus: { not: 2 }, Email: { not: null } },
      select: { PatNum: true, Email: true, FName: true, DateFirstVisit: true },
    });

    const cooldownCutoff = new Date();
    cooldownCutoff.setDate(cooldownCutoff.getDate() - REMINDER_COOLDOWN_DAYS);
    const todayStr = new Date().toISOString().slice(0, 10);

    let duePatients = 0;
    let remindersSent = 0;
    let skipped = 0;

    for (const patient of patients) {
      const patNum = patient.PatNum;
      const patNumStr = patNum.toString();
      let patientIsDue = false;
      const dueRecallDescriptions: string[] = [];

      // 1. Check per-CDT recall types
      for (const rt of recallTypes) {
        const intervalMonths = rt.DefaultInterval ?? defaultIntervalMonths;
        const offsetDays = 0;
        const triggerCodeNums = rt.recalltrigger
          .map((t) => t.CodeNum)
          .filter((c): c is bigint => c !== null);

        if (triggerCodeNums.length === 0) continue;

        const lastProc = await prisma.procedurelog.findFirst({
          where: {
            PatNum: patNum,
            ProcStatus: 2,
            CodeNum: { in: triggerCodeNums },
          },
          orderBy: [{ ProcDate: 'desc' }, { DateComplete: 'desc' }],
          select: { ProcDate: true, DateComplete: true },
        });

        const rawDate = lastProc?.ProcDate ?? lastProc?.DateComplete ?? null;
        if (!rawDate) continue;

        const lastCompletedDate = (
          rawDate instanceof Date ? rawDate.toISOString() : String(rawDate)
        ).slice(0, 10);
        const dueDate = calculateDueDate(lastCompletedDate, intervalMonths, offsetDays);

        if (dueDate <= todayStr) {
          patientIsDue = true;
          dueRecallDescriptions.push(rt.Description || 'Recare');

          // Upsert row into OpenDental's native `recall` table
          const existingRecall = await prisma.recall.findFirst({
            where: { PatNum: patNum, RecallTypeNum: rt.RecallTypeNum, IsDisabled: 0 },
          });

          const noteMeta = parseNote(existingRecall?.Note);
          const nextNote = JSON.stringify({
            ...noteMeta,
            recallTypeName: rt.Description,
            calculatedDueDate: dueDate,
          });

          const dueDateObj = new Date(dueDate);
          const lastCompletedObj = new Date(lastCompletedDate);

          if (existingRecall) {
            await prisma.recall.update({
              where: { RecallNum: existingRecall.RecallNum },
              data: {
                DateDue: dueDateObj,
                DateDueCalc: dueDateObj,
                DatePrevious: lastCompletedObj,
                RecallInterval: intervalMonths * 30,
                Note: nextNote,
                DateTStamp: new Date(),
              },
            });
          } else {
            const nextId = await getNextId('recall', 'RecallNum');
            await prisma.recall.create({
              data: {
                RecallNum: nextId,
                PatNum: patNum,
                RecallTypeNum: rt.RecallTypeNum,
                DateDue: dueDateObj,
                DateDueCalc: dueDateObj,
                DatePrevious: lastCompletedObj,
                RecallInterval: intervalMonths * 30,
                IsDisabled: 0,
                Note: nextNote,
                DateTStamp: new Date(),
              },
            });
          }
        }
      }

      // 2. Fallback: If no per-CDT procedures triggered due, check last completed appointment / DateFirstVisit
      if (!patientIsDue) {
        const lastAppt = await prisma.appointment.findFirst({
          where: { PatNum: patNum, AptStatus: 2 },
          orderBy: { AptDateTime: 'desc' },
          select: { AptDateTime: true },
        });

        const fallbackVisit = lastAppt?.AptDateTime ?? patient.DateFirstVisit ?? null;
        if (fallbackVisit) {
          const fallbackDateStr = (
            fallbackVisit instanceof Date ? fallbackVisit.toISOString() : String(fallbackVisit)
          ).slice(0, 10);
          const fallbackDueDate = calculateDueDate(fallbackDateStr, defaultIntervalMonths, 0);

          if (fallbackDueDate <= todayStr) {
            patientIsDue = true;
            dueRecallDescriptions.push('Routine Check-up');

            const existingRecall = await prisma.recall.findFirst({
              where: { PatNum: patNum, RecallTypeNum: null, IsDisabled: 0 },
            });
            const noteMeta = parseNote(existingRecall?.Note);
            const nextNote = JSON.stringify({ ...noteMeta, calculatedDueDate: fallbackDueDate });
            const dueDateObj = new Date(fallbackDueDate);
            const visitObj = new Date(fallbackDateStr);

            if (existingRecall) {
              await prisma.recall.update({
                where: { RecallNum: existingRecall.RecallNum },
                data: {
                  DateDue: dueDateObj,
                  DateDueCalc: dueDateObj,
                  DatePrevious: visitObj,
                  RecallInterval: defaultIntervalMonths * 30,
                  Note: nextNote,
                  DateTStamp: new Date(),
                },
              });
            } else {
              const nextId = await getNextId('recall', 'RecallNum');
              await prisma.recall.create({
                data: {
                  RecallNum: nextId,
                  PatNum: patNum,
                  DateDue: dueDateObj,
                  DateDueCalc: dueDateObj,
                  DatePrevious: visitObj,
                  RecallInterval: defaultIntervalMonths * 30,
                  IsDisabled: 0,
                  Note: nextNote,
                  DateTStamp: new Date(),
                },
              });
            }
          }
        }
      }

      if (!patientIsDue) continue;

      duePatients++;

      // Check cooldown on patient's most recent recall reminder
      const latestRecallForCooldown = await prisma.recall.findFirst({
        where: { PatNum: patNum, IsDisabled: 0 },
        orderBy: { DateTStamp: 'desc' },
      });

      const noteMeta = parseNote(latestRecallForCooldown?.Note);
      const lastReminderSentAt = noteMeta.lastReminderSentAt
        ? new Date(noteMeta.lastReminderSentAt)
        : null;

      if (lastReminderSentAt && lastReminderSentAt > cooldownCutoff) {
        skipped++;
        continue;
      }

      // Send email reminder
      try {
        const recallListStr = dueRecallDescriptions.slice(0, 2).join(' & ');
        await emailService.sendBulkEmail(
          patient.Email!,
          "You're due for your dental check-up",
          `Hi ${patient.FName ?? ''}, our records show you are due for your ${recallListStr || 'routine check-up'}. ` +
            `Please call our office or use the patient portal to schedule your next appointment.`
        );
        remindersSent++;

        if (latestRecallForCooldown) {
          const updatedNote = JSON.stringify({
            ...noteMeta,
            lastReminderSentAt: new Date().toISOString(),
          });
          await prisma.recall.update({
            where: { RecallNum: latestRecallForCooldown.RecallNum },
            data: { Note: updatedNote, DateTStamp: new Date() },
          });
        }
      } catch (error) {
        console.error(`Recare reminder failed for patient ${patNumStr}:`, error);
        skipped++;
      }
    }

    return {
      autoReminderEnabled,
      intervalMonths: defaultIntervalMonths,
      patientsChecked: patients.length,
      duePatients,
      remindersSent,
      skipped,
    };
  }
}

export const recareService = new RecareService();
