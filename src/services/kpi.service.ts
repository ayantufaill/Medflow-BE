import { prisma } from '../config/db';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * OpenDental ProcStatus codes:
 *  1 = Treatment Planned (TP)
 *  2 = Complete
 *  3 = Existing Current
 *  4 = Existing Other
 *  5 = Referred Out
 *  6 = Deleted
 *  7 = Condition
 *  8 = Rejected
 */
const PROC_STATUS_COMPLETE = 2;
const PROC_STATUS_TP = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates an array of 12 { year, month } buckets (UTC) going back from the
 * current month. Index 0 = most recent month, index 11 = 12 months ago.
 */
function getLast12MonthBuckets(): Array<{ year: number; month: number; start: Date; end: Date }> {
  const now = new Date();
  const buckets: Array<{ year: number; month: number; start: Date; end: Date }> = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-indexed

    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1)); // exclusive upper bound

    buckets.push({ year, month, start, end });
  }

  return buckets;
}

/**
 * Given a Date, returns the bucket index (0-based, 0 = most recent month)
 * for the given list of buckets, or -1 if it doesn't fall in any.
 */
function getBucketIndex(
  date: Date,
  buckets: Array<{ start: Date; end: Date }>
): number {
  const t = date.getTime();
  return buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
}

/**
 * Format a number as a locale string with 2 decimal places.
 * e.g. 53211.8 → "53,211.80"
 */
function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format an integer count.
 */
function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

// ─── KPI Service ─────────────────────────────────────────────────────────────

export class KpiService {
  private async resolveClinicNums(branchId?: string, userId?: string): Promise<bigint[] | undefined> {
    let targetClinicNums: bigint[] | undefined = undefined;
    if (branchId && branchId !== 'All') {
      targetClinicNums = [BigInt(branchId)];
    } else if (userId) {
      const branches = await prisma.userclinic.findMany({ where: { UserNum: Number(userId) }, select: { ClinicNum: true } });
      targetClinicNums = branches.map((b) => b.ClinicNum).filter(Boolean) as bigint[];
    }
    return targetClinicNums;
  }

  /**
   * Returns consolidated KPI metrics for the rolling last 12 months.
   * All values arrays are ordered: index 0 = most recent month.
   */
  async getMainKpis(startDate?: Date, endDate?: Date, branchId?: string, userId?: string) {
    const buckets = getLast12MonthBuckets();
    const rangeStart = buckets[11].start;
    const rangeEnd = buckets[0].end;
    
    const targetClinicNums = await this.resolveClinicNums(branchId, userId);

    // ── 1. Load all providers to classify Doctor vs Hygiene ──────────────────
    const providers = await prisma.provider.findMany({
      select: { ProvNum: true, IsSecondary: true, IsHidden: true, FName: true, LName: true },
    });

    // IsSecondary = 1 → hygienist, 0 → doctor
    const hygieneProvNums = new Set(
      providers.filter((p) => p.IsSecondary === 1).map((p) => p.ProvNum)
    );

    // ── 2. Production: completed procedurelog rows ────────────────────────────
    const procLogs = await prisma.procedurelog.findMany({
      where: {
        ProcStatus: PROC_STATUS_COMPLETE,
        ProcDate: { gte: rangeStart, lt: rangeEnd },
        ProcFee: { not: null },
        ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
      },
      select: { ProcDate: true, ProcFee: true, ProvNum: true, Discount: true },
    });

    // ── 3. Adjustments (net production = gross - adjustments) ─────────────────
    const adjustments = await prisma.adjustment.findMany({
      where: {
        AdjDate: { gte: rangeStart, lt: rangeEnd },
        ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
      },
      select: { AdjDate: true, AdjAmt: true, ProvNum: true },
    });

    // ── 4. Collections via paysplit (patient payments, linked to provider) ────
    const paySplits = await prisma.paysplit.findMany({
      where: {
        DatePay: { gte: rangeStart, lt: rangeEnd },
        IsDiscount: 0,
        ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
      },
      select: { DatePay: true, SplitAmt: true, ProvNum: true },
    });

    // ── 5. Seen patients per month ────────────────────────────────────────────
    // AptStatus = 2 means Complete in OpenDental
    const completedAppts = await prisma.appointment.findMany({
      where: {
        AptDateTime: { gte: rangeStart, lt: rangeEnd },
        AptStatus: 2,
        ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
      },
      select: { AptDateTime: true, PatNum: true, ProvNum: true },
    });

    // ── 6. Treatment plan procedures (Case Diagnostic) ───────────────────────
    // Fetch TP-status procs created in the period (DateTP is when TP was created)
    const tpProcs = await prisma.procedurelog.findMany({
      where: {
        ProcStatus: PROC_STATUS_TP,
        DateTP: { gte: rangeStart, lt: rangeEnd },
        ProcFee: { not: null },
        ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
      },
      select: { DateTP: true, ProcFee: true, ProvNum: true },
    });

    // ── Aggregate into buckets ────────────────────────────────────────────────

    // Initialize zero arrays
    const gross = Array(12).fill(0);
    const grossDoc = Array(12).fill(0);
    const grossHyg = Array(12).fill(0);
    const netAdj = Array(12).fill(0); // total adjustments per bucket
    const netAdjDoc = Array(12).fill(0);
    const netAdjHyg = Array(12).fill(0);
    const collectionTotal = Array(12).fill(0);
    const collectionDoc = Array(12).fill(0);
    const collectionHyg = Array(12).fill(0);
    const seenPatients = Array(12).fill(0);
    const seenPatientSets: Set<bigint>[] = Array.from({ length: 12 }, () => new Set());
    const tpAccepted = Array(12).fill(0); // proxy for "Accepted" case metric
    const tpDiagnosed = Array(12).fill(0);

    // Gross production
    for (const row of procLogs) {
      if (!row.ProcDate) continue;
      const idx = getBucketIndex(row.ProcDate, buckets);
      if (idx === -1) continue;
      const fee = row.ProcFee ?? 0;
      gross[idx] += fee;
      if (hygieneProvNums.has(row.ProvNum!)) {
        grossHyg[idx] += fee;
      } else {
        grossDoc[idx] += fee;
      }
    }

    // Adjustments (negative = reduce production, positive = increase)
    for (const row of adjustments) {
      if (!row.AdjDate) continue;
      const idx = getBucketIndex(row.AdjDate, buckets);
      if (idx === -1) continue;
      const amt = row.AdjAmt ?? 0;
      netAdj[idx] += amt;
      if (hygieneProvNums.has(row.ProvNum!)) {
        netAdjHyg[idx] += amt;
      } else {
        netAdjDoc[idx] += amt;
      }
    }

    // Collections
    for (const row of paySplits) {
      if (!row.DatePay) continue;
      const idx = getBucketIndex(row.DatePay, buckets);
      if (idx === -1) continue;
      const amt = row.SplitAmt ?? 0;
      collectionTotal[idx] += amt;
      if (hygieneProvNums.has(row.ProvNum!)) {
        collectionHyg[idx] += amt;
      } else {
        collectionDoc[idx] += amt;
      }
    }

    // Seen patients (unique per month)
    for (const appt of completedAppts) {
      if (!appt.AptDateTime || !appt.PatNum) continue;
      const idx = getBucketIndex(appt.AptDateTime, buckets);
      if (idx === -1) continue;
      seenPatientSets[idx].add(appt.PatNum);
    }
    for (let i = 0; i < 12; i++) {
      seenPatients[i] = seenPatientSets[i].size;
    }

    // TP procedures — "Diagnosed" vs "Accepted" proxy
    for (const row of tpProcs) {
      if (!row.DateTP) continue;
      const idx = getBucketIndex(row.DateTP, buckets);
      if (idx === -1) continue;
      const fee = row.ProcFee ?? 0;
      tpDiagnosed[idx] += fee;
    }

    // Completed procedures = "Accepted/Completed" case metric
    for (const row of procLogs) {
      if (!row.ProcDate) continue;
      const idx = getBucketIndex(row.ProcDate, buckets);
      if (idx === -1) continue;
      tpAccepted[idx] += row.ProcFee ?? 0;
    }

    // Derive net production = gross - adjustments
    const net = gross.map((g, i) => g + netAdj[i]); // AdjAmt can be negative
    const netDoc = grossDoc.map((g, i) => g + netAdjDoc[i]);
    const netHyg = grossHyg.map((g, i) => g + netAdjHyg[i]);

    // ── Build response matrix ─────────────────────────────────────────────────
    return [
      {
        title: 'Production Metrics',
        rows: [
          { label: 'Gross Production', values: gross.map(fmt) },
          { label: 'Doctor Gross Production', values: grossDoc.map(fmt) },
          { label: 'Hygiene Gross Production', values: grossHyg.map(fmt) },
        ],
      },
      {
        title: 'Net Production Metrics',
        rows: [
          { label: 'Net Production', values: net.map(fmt) },
          { label: 'Doctor Net Production', values: netDoc.map(fmt) },
          { label: 'Hygiene Production', values: netHyg.map(fmt) },
        ],
      },
      {
        title: 'Collection Metrics',
        rows: [
          { label: 'Gross Collection', values: collectionTotal.map(fmt) },
          { label: 'Doctor Gross Collection', values: collectionDoc.map(fmt) },
          { label: 'Hygiene Gross Collection', values: collectionHyg.map(fmt) },
        ],
      },
      {
        title: 'Total Collection Metrics',
        rows: [
          { label: 'Total Collection', values: collectionTotal.map(fmt) },
          { label: 'Doctor Collection', values: collectionDoc.map(fmt) },
          { label: 'Hygiene Collection', values: collectionHyg.map(fmt) },
        ],
      },
      {
        title: 'Patient & Exam Metrics',
        rows: [
          { label: 'Total Seen Patients', values: seenPatients.map(fmtInt) },
        ],
      },
      {
        title: 'Case Diagnostic Metrics',
        rows: [
          { label: 'Diagnosed', values: tpDiagnosed.map(fmt) },
          { label: 'Accepted', values: tpAccepted.map(fmt) },
          { label: 'Completed', values: tpAccepted.map(fmt) },
        ],
      },
    ];
  }

  /**
   * Returns KPI metrics grouped by provider for the rolling last 12 months.
   */
  async getProviderKpis(startDate?: Date, endDate?: Date, branchId?: string, userId?: string) {
    const buckets = getLast12MonthBuckets();
    const rangeStart = buckets[11].start;
    const rangeEnd = buckets[0].end;
    
    const targetClinicNums = await this.resolveClinicNums(branchId, userId);

    // ── Load all non-hidden providers ─────────────────────────────────────────
    const providers = await prisma.provider.findMany({
      where: { IsHidden: 0 },
      select: {
        ProvNum: true,
        FName: true,
        LName: true,
        IsSecondary: true,
        HourlyProdGoalAmt: true,
      },
      orderBy: { LName: 'asc' },
    });

    if (providers.length === 0) return [];

    const provNums = providers.map((p) => p.ProvNum);

    // ── Bulk fetch data for all providers ─────────────────────────────────────

    // Gross production per provider
    const procLogs = await prisma.procedurelog.findMany({
      where: {
        ProcStatus: PROC_STATUS_COMPLETE,
        ProcDate: { gte: rangeStart, lt: rangeEnd },
        ProvNum: { in: provNums },
        ProcFee: { not: null },
        ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
      },
      select: { ProcDate: true, ProcFee: true, ProvNum: true },
    });

    // Adjustments per provider
    const adjustments = await prisma.adjustment.findMany({
      where: {
        AdjDate: { gte: rangeStart, lt: rangeEnd },
        ProvNum: { in: provNums },
        ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
      },
      select: { AdjDate: true, AdjAmt: true, ProvNum: true },
    });

    // Collections per provider
    const paySplits = await prisma.paysplit.findMany({
      where: {
        DatePay: { gte: rangeStart, lt: rangeEnd },
        IsDiscount: 0,
        ProvNum: { in: provNums },
        ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
      },
      select: { DatePay: true, SplitAmt: true, ProvNum: true },
    });

    // Appointments per provider
    const appointments = await prisma.appointment.findMany({
      where: {
        AptDateTime: { gte: rangeStart, lt: rangeEnd },
        AptStatus: 2,
        ProvNum: { in: provNums },
        ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
      },
      select: { AptDateTime: true, PatNum: true, ProvNum: true },
    });

    // ── Aggregate per provider per bucket ─────────────────────────────────────

    // Build maps keyed by ProvNum.toString()
    const grossMap: Record<string, number[]> = {};
    const adjMap: Record<string, number[]> = {};
    const collMap: Record<string, number[]> = {};
    const apptCountMap: Record<string, number[]> = {};
    const seenPtMap: Record<string, Set<bigint>[]> = {};

    for (const p of providers) {
      const key = p.ProvNum.toString();
      grossMap[key] = Array(12).fill(0);
      adjMap[key] = Array(12).fill(0);
      collMap[key] = Array(12).fill(0);
      apptCountMap[key] = Array(12).fill(0);
      seenPtMap[key] = Array.from({ length: 12 }, () => new Set<bigint>());
    }

    for (const row of procLogs) {
      if (!row.ProcDate || !row.ProvNum) continue;
      const idx = getBucketIndex(row.ProcDate, buckets);
      const key = row.ProvNum.toString();
      if (idx === -1 || !grossMap[key]) continue;
      grossMap[key][idx] += row.ProcFee ?? 0;
    }

    for (const row of adjustments) {
      if (!row.AdjDate || !row.ProvNum) continue;
      const idx = getBucketIndex(row.AdjDate, buckets);
      const key = row.ProvNum.toString();
      if (idx === -1 || !adjMap[key]) continue;
      adjMap[key][idx] += row.AdjAmt ?? 0;
    }

    for (const row of paySplits) {
      if (!row.DatePay || !row.ProvNum) continue;
      const idx = getBucketIndex(row.DatePay, buckets);
      const key = row.ProvNum.toString();
      if (idx === -1 || !collMap[key]) continue;
      collMap[key][idx] += row.SplitAmt ?? 0;
    }

    for (const appt of appointments) {
      if (!appt.AptDateTime || !appt.ProvNum) continue;
      const idx = getBucketIndex(appt.AptDateTime, buckets);
      const key = appt.ProvNum.toString();
      if (idx === -1 || !apptCountMap[key]) continue;
      apptCountMap[key][idx]++;
      if (appt.PatNum) seenPtMap[key][idx].add(appt.PatNum);
    }

    // ── Build per-provider response ───────────────────────────────────────────

    return providers.map((provider) => {
      const key = provider.ProvNum.toString();
      const fullName = `${provider.FName ?? ''} ${provider.LName ?? ''}`.trim();

      const gross = grossMap[key];
      const adj = adjMap[key];
      const coll = collMap[key];
      const apptCount = apptCountMap[key];
      const seenSets = seenPtMap[key];

      const net = gross.map((g, i) => g + adj[i]);
      const seenPt = seenSets.map((s) => s.size);

      // Production per visit: net / seen patients (avoid divide-by-zero)
      const prodPerVisit = net.map((n, i) => (seenPt[i] > 0 ? n / seenPt[i] : 0));

      return {
        name: fullName,
        isHygienist: provider.IsSecondary === 1,
        groups: [
          {
            title: 'Provider Production Metrics',
            rows: [
              { label: 'Provider Gross Production', values: gross.map(fmt) },
              { label: 'Provider Net Production', values: net.map(fmt) },
              { label: 'Provider Total Collection', values: coll.map(fmt) },
            ],
          },
          {
            title: 'Provider Appointment Metrics',
            rows: [
              { label: 'Provider Total Appointments', values: apptCount.map(fmtInt) },
              { label: 'Provider Seen Patients', values: seenPt.map(fmtInt) },
            ],
          },
          {
            title: 'Provider Work Efficiency Metrics',
            rows: [
              { label: 'Provider Production Per Visit', values: prodPerVisit.map(fmt) },
            ],
          },
        ],
      };
    });
  }

  /**
   * Returns 4 top-card summary metrics comparing current month vs last month.
   * Suitable for a dedicated GET /kpis/summary endpoint.
   */
  async getKpiSummary(branchId?: string, userId?: string) {
    const buckets = getLast12MonthBuckets();
    const thisMonth = buckets[0];
    const lastMonth = buckets[1];
    
    const targetClinicNums = await this.resolveClinicNums(branchId, userId);

    // Helper: sum paysplit for a date range
    const sumCollection = async (start: Date, end: Date) => {
      const rows = await prisma.paysplit.aggregate({
        _sum: { SplitAmt: true },
        where: { DatePay: { gte: start, lt: end }, IsDiscount: 0, ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined },
      });
      return rows._sum.SplitAmt ?? 0;
    };

    // Helper: sum gross production for a date range
    const sumProduction = async (start: Date, end: Date) => {
      const rows = await prisma.procedurelog.aggregate({
        _sum: { ProcFee: true },
        where: {
          ProcStatus: PROC_STATUS_COMPLETE,
          ProcDate: { gte: start, lt: end },
          ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
        },
      });
      return rows._sum.ProcFee ?? 0;
    };

    // Helper: count seen patients for a date range
    const countSeen = async (start: Date, end: Date) => {
      const appts = await prisma.appointment.findMany({
        where: { AptDateTime: { gte: start, lt: end }, AptStatus: 2, ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined },
        select: { PatNum: true },
        distinct: ['PatNum'],
      });
      return appts.length;
    };

    // Helper: sum accepted treatment plan value for a date range
    const sumCaseAccepted = async (start: Date, end: Date) => {
      const rows = await prisma.procedurelog.aggregate({
        _sum: { ProcFee: true },
        where: {
          ProcStatus: PROC_STATUS_COMPLETE,
          ProcDate: { gte: start, lt: end },
          ClinicNum: targetClinicNums ? { in: targetClinicNums } : undefined,
        },
      });
      return rows._sum.ProcFee ?? 0;
    };

    const [
      thisProd, lastProd,
      thisColl, lastColl,
      thisSeen, lastSeen,
      thisCaseAcc, lastCaseAcc,
    ] = await Promise.all([
      sumProduction(thisMonth.start, thisMonth.end),
      sumProduction(lastMonth.start, lastMonth.end),
      sumCollection(thisMonth.start, thisMonth.end),
      sumCollection(lastMonth.start, lastMonth.end),
      countSeen(thisMonth.start, thisMonth.end),
      countSeen(lastMonth.start, lastMonth.end),
      sumCaseAccepted(thisMonth.start, thisMonth.end),
      sumCaseAccepted(lastMonth.start, lastMonth.end),
    ]);

    const pctChange = (cur: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100);

    return {
      netProduction: {
        current: thisProd,
        previous: lastProd,
        changePercent: pctChange(thisProd, lastProd),
      },
      totalCollection: {
        current: thisColl,
        previous: lastColl,
        changePercent: pctChange(thisColl, lastColl),
      },
      seenPatients: {
        current: thisSeen,
        previous: lastSeen,
        changePercent: pctChange(thisSeen, lastSeen),
      },
      caseAccepted: {
        current: thisCaseAcc,
        previous: lastCaseAcc,
        changePercent: pctChange(thisCaseAcc, lastCaseAcc),
      },
    };
  }
}

export const kpiService = new KpiService();
