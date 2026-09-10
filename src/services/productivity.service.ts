import { prisma } from '../config/db';
import { dashboardMetricsService } from './dashboard-metrics.service';
import { getProvidersMeta } from '../utils/opendental-auth.util';

export interface PanelRow {
  id: 'P' | 'C' | 'GP' | 'GC';
  label: string;
  value: number;
  goal?: number;
  color: string;
}

export interface PanelSection {
  title: string;
  scheduled: number;
  scheduledVisits?: number;
  rows: PanelRow[];
  perHour: number;
  perHourGoal: number;
  perVisit: number;
  perVisitGoal: number;
}

export interface PanelSummaryData {
  total: PanelSection;
  dentist: PanelSection;
  hygienist: PanelSection;
}

export class ProductivityService {
  /**
   * Returns daily production totals for the given date range.
   */
  async getProductionOverTime(startDate: Date, endDate: Date) {
    const data: any[] = await prisma.$queryRaw`
      SELECT 
        CAST("ProcDate" AS DATE) as date,
        SUM("ProcFee") as value
      FROM "procedurelog"
      WHERE "ProcDate" >= ${startDate} 
        AND "ProcDate" <= ${endDate}
        AND "ProcStatus" = 2
      GROUP BY CAST("ProcDate" AS DATE)
      ORDER BY date ASC
    `;
    
    return data.map(item => ({
      label: item.date ? new Date(item.date).toISOString().split('T')[0] : 'Unknown',
      value: Number(item.value) || 0
    }));
  }

  /**
   * Returns total production grouped by Provider.
   */
  async getProductionByProvider(startDate: Date, endDate: Date) {
    const data: any[] = await prisma.$queryRaw`
      SELECT 
        COALESCE(pr."Abbr", 'Unknown') as label,
        SUM(pl."ProcFee") as value
      FROM "procedurelog" pl
      LEFT JOIN "provider" pr ON pl."ProvNum" = pr."ProvNum"
      WHERE pl."ProcDate" >= ${startDate} 
        AND pl."ProcDate" <= ${endDate}
        AND pl."ProcStatus" = 2
      GROUP BY pr."Abbr"
      ORDER BY value DESC
    `;
    
    return data.map(item => ({
      label: item.label,
      value: Number(item.value) || 0
    }));
  }

  /**
   * Returns total production grouped by Operatory.
   */
  async getProductionByOperatory(startDate: Date, endDate: Date) {
    const data: any[] = await prisma.$queryRaw`
      SELECT 
        COALESCE(op."OpName", 'Unassigned') as label,
        SUM(pl."ProcFee") as value
      FROM "procedurelog" pl
      LEFT JOIN "appointment" a ON pl."AptNum" = a."AptNum"
      LEFT JOIN "operatory" op ON a."Op" = op."OperatoryNum"
      WHERE pl."ProcDate" >= ${startDate} 
        AND pl."ProcDate" <= ${endDate}
        AND pl."ProcStatus" = 2
      GROUP BY op."OpName"
      ORDER BY value DESC
    `;
    
    return data.map(item => ({
      label: item.label,
      value: Number(item.value) || 0
    }));
  }

  /**
   * Returns daily productivity panel summary for Total, Dentist, and Hygienist.
   */
  async getPanelSummary(dateStr: string, providerId?: string, clinicNum?: bigint): Promise<PanelSummaryData> {
    const [year, month, day] = dateStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // 1. Fetch practice goals
    const goals = await dashboardMetricsService.getDashboardGoals();

    // 2. Fetch active providers and classify Dentist vs. Hygienist
    const providers = await prisma.provider.findMany({
      where: { IsHidden: 0 },
      include: {
        definition: true,
        providerclinic: true,
      },
    });

    const dentistIds: bigint[] = [];
    const hygienistIds: bigint[] = [];
    const providerMap = new Map<string, { isHygienist: boolean; provNum: bigint }>();

    for (const p of providers) {
      if (clinicNum && p.providerclinic.length > 0) {
        const matchesClinic = p.providerclinic.some(pc => pc.ClinicNum === clinicNum);
        if (!matchesClinic) continue;
      }

      const spec = p.definition?.ItemName?.toLowerCase() || '';
      const isHygienist = p.IsSecondary === 1 || spec.includes('hygiene') || spec.includes('hygienist');
      if (isHygienist) {
        hygienistIds.push(p.ProvNum);
      } else {
        dentistIds.push(p.ProvNum);
      }
      providerMap.set(p.ProvNum.toString(), { isHygienist, provNum: p.ProvNum });
    }

    // 3. Determine filtered provider numbers
    let targetProvNums: bigint[] = [];
    let singleProviderMode = false;
    let filterIsHygienist = false;

    if (providerId && providerId.toLowerCase() !== 'all') {
      if (providerId.toLowerCase() === 'hygienist') {
        targetProvNums = hygienistIds;
        filterIsHygienist = true;
      } else if (providerId.toLowerCase() === 'dentist') {
        targetProvNums = dentistIds;
        filterIsHygienist = false;
      } else {
        const found = providerMap.get(providerId);
        if (found) {
          targetProvNums = [found.provNum];
          filterIsHygienist = found.isHygienist;
          singleProviderMode = true;
        } else {
          try {
            targetProvNums = [BigInt(providerId)];
            singleProviderMode = true;
          } catch {
            targetProvNums = [];
          }
        }
      }
    }

    const provWhere = targetProvNums.length > 0 ? { ProvNum: { in: targetProvNums } } : {};
    const clinicWhere = clinicNum ? { ClinicNum: clinicNum } : {};

    // 4. Query completed procedures (P)
    const completedProcs = await prisma.procedurelog.findMany({
      where: {
        ProcDate: { gte: startDate, lte: endDate },
        ProcStatus: 2, // Completed
        ...provWhere,
        ...clinicWhere,
      },
      select: { ProcFee: true, ProvNum: true },
    });

    let totalP = 0;
    let dentistP = 0;
    let hygienistP = 0;

    for (const proc of completedProcs) {
      const fee = proc.ProcFee ?? 0;
      totalP += fee;
      const prov = providerMap.get(proc.ProvNum?.toString() || '');
      if (prov?.isHygienist) hygienistP += fee;
      else dentistP += fee;
    }

    // 5. Query planned procedures
    const plannedProcs = await prisma.procedurelog.findMany({
      where: {
        ProcDate: { gte: startDate, lte: endDate },
        ProcStatus: 1, // Planned
        ...provWhere,
        ...clinicWhere,
      },
      select: { ProcFee: true, ProvNum: true },
    });

    let totalPlanned = 0;
    let dentistPlanned = 0;
    let hygienistPlanned = 0;

    for (const proc of plannedProcs) {
      const fee = proc.ProcFee ?? 0;
      totalPlanned += fee;
      const prov = providerMap.get(proc.ProvNum?.toString() || '');
      if (prov?.isHygienist) hygienistPlanned += fee;
      else dentistPlanned += fee;
    }

    // 6. Query Collections (C) from paysplit and claimproc
    const paySplits = await prisma.paysplit.findMany({
      where: {
        DatePay: { gte: startDate, lte: endDate },
        IsDiscount: 0,
        ...provWhere,
        ...clinicWhere,
      },
      select: { SplitAmt: true, ProvNum: true },
    });

    const claimProcs = await prisma.claimproc.findMany({
      where: {
        DateCP: { gte: startDate, lte: endDate },
        Status: { in: [1, 4] },
        ...provWhere,
        ...clinicWhere,
      },
      select: { InsPayAmt: true, ProvNum: true },
    });

    let totalC = 0;
    let dentistC = 0;
    let hygienistC = 0;

    for (const split of paySplits) {
      const amt = split.SplitAmt ?? 0;
      totalC += amt;
      const prov = providerMap.get(split.ProvNum?.toString() || '');
      if (prov?.isHygienist) hygienistC += amt;
      else dentistC += amt;
    }

    for (const cp of claimProcs) {
      const amt = cp.InsPayAmt ?? 0;
      totalC += amt;
      const prov = providerMap.get(cp.ProvNum?.toString() || '');
      if (prov?.isHygienist) hygienistC += amt;
      else dentistC += amt;
    }

    // 7. Query Scheduled Appointments and calculate Scheduled Production (S)
    const scheduledAppts = await prisma.appointment.findMany({
      where: {
        AptDateTime: { gte: startDate, lte: endDate },
        AptStatus: { notIn: [3, 4, 6] }, // Exclude no-show, cancelled, unscheduled
        ...provWhere,
        ...clinicWhere,
      },
      select: {
        AptNum: true,
        ProvNum: true,
      },
    });

    let totalScheduledFee = 0;
    let dentistScheduledFee = 0;
    let hygienistScheduledFee = 0;
    const totalScheduledVisits = scheduledAppts.length;
    let dentistScheduledVisits = 0;
    let hygienistScheduledVisits = 0;

    for (const appt of scheduledAppts) {
      const prov = providerMap.get(appt.ProvNum?.toString() || '');
      if (prov?.isHygienist) hygienistScheduledVisits++;
      else dentistScheduledVisits++;
    }

    const aptNums = scheduledAppts.map(a => a.AptNum);
    if (aptNums.length > 0) {
      const aptProcs = await prisma.procedurelog.findMany({
        where: { AptNum: { in: aptNums } },
        select: { ProcFee: true, ProvNum: true },
      });
      for (const proc of aptProcs) {
        const fee = proc.ProcFee ?? 0;
        totalScheduledFee += fee;
        const prov = providerMap.get(proc.ProvNum?.toString() || '');
        if (prov?.isHygienist) hygienistScheduledFee += fee;
        else dentistScheduledFee += fee;
      }
    }

    // If appointments did not have explicit procedure fee links, use planned + completed procs for scheduled value
    if (totalScheduledFee === 0 && (totalPlanned > 0 || totalP > 0)) {
      totalScheduledFee = totalPlanned + totalP;
      dentistScheduledFee = dentistPlanned + dentistP;
      hygienistScheduledFee = hygienistPlanned + hygienistP;
    }

    // 8. Working hours for provider per-hour calculations
    const dayOfWeek = startDate.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    let dentistHours = 0;
    let hygienistHours = 0;

    const providerNums = providers.map((p) => p.ProvNum);
    const providersMeta = await getProvidersMeta(providerNums);

    for (const p of providers) {
      if (targetProvNums.length > 0 && !targetProvNums.includes(p.ProvNum)) continue;

      const meta = providersMeta[p.ProvNum.toString()] ?? {};
      let pHours = 0;

      if (meta.workingHours && Array.isArray(meta.workingHours)) {
        const item = meta.workingHours.find((wh: any) => wh.dayOfWeek === dayOfWeek);
        if (item && item.isAvailable && item.startTime && item.endTime) {
          const [sh, sm] = item.startTime.split(':').map(Number);
          const [eh, em] = item.endTime.split(':').map(Number);
          pHours = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
        }
      } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        pHours = 8; // Standard 8h weekday default
      }

      const prov = providerMap.get(p.ProvNum.toString());
      if (prov?.isHygienist) {
        hygienistHours += pHours;
      } else {
        dentistHours += pHours;
      }
    }

    const totalHours = dentistHours + hygienistHours;

    // 9. If in single provider mode, isolate to the relevant discipline
    if (singleProviderMode) {
      if (filterIsHygienist) {
        dentistP = 0;
        dentistPlanned = 0;
        dentistC = 0;
        dentistScheduledFee = 0;
        dentistScheduledVisits = 0;
        dentistHours = 0;
      } else {
        hygienistP = 0;
        hygienistPlanned = 0;
        hygienistC = 0;
        hygienistScheduledFee = 0;
        hygienistScheduledVisits = 0;
        hygienistHours = 0;
      }
    }

    // 10. Goals calculations
    const dentistHourlyGoal = goals.dentistHourlyGoal || 300;
    const hygienistHourlyGoal = goals.hygienistHourlyGoal || 120;
    const dentistVisitGoal = goals.dentistVisitGoal || 250;
    const hygienistVisitGoal = goals.hygienistVisitGoal || 150;

    const dentistPGoal = dentistHours > 0 ? dentistHours * dentistHourlyGoal : dentistHourlyGoal * 8;
    const hygienistPGoal = hygienistHours > 0 ? hygienistHours * hygienistHourlyGoal : hygienistHourlyGoal * 8;
    const totalPGoal = dentistPGoal + hygienistPGoal;

    const totalCGoal = totalPGoal * (goals.collectionPercentGoal ? goals.collectionPercentGoal / 100 : 0.95);
    const dentistCGoal = dentistPGoal * 0.95;
    const hygienistCGoal = hygienistPGoal * 0.95;

    const totalPerHourGoal = totalHours > 0 ? totalPGoal / totalHours : (dentistHourlyGoal + hygienistHourlyGoal) / 2;
    const totalVisitGoal = goals.totalVisitGoal || (dentistVisitGoal + hygienistVisitGoal) / 2;

    // Gross production and collections
    const totalGP = totalP + totalPlanned;
    const dentistGP = dentistP + dentistPlanned;
    const hygienistGP = hygienistP + hygienistPlanned;

    const totalGC = totalC;
    const dentistGC = dentistC;
    const hygienistGC = hygienistC;

    // Per-hour and Per-visit
    const calcRate = (val: number, divisor: number) => divisor > 0 ? Math.round((val / divisor) * 100) / 100 : 0;

    const totalPerHour = calcRate(totalP, totalHours);
    const dentistPerHour = calcRate(dentistP, dentistHours);
    const hygienistPerHour = calcRate(hygienistP, hygienistHours);

    const totalPerVisit = calcRate(totalP, totalScheduledVisits);
    const dentistPerVisit = calcRate(dentistP, dentistScheduledVisits);
    const hygienistPerVisit = calcRate(hygienistP, hygienistScheduledVisits);

    const formatRows = (p: number, c: number, gp: number, gc: number, pGoal: number, cGoal: number): PanelRow[] => [
      { id: 'P', label: 'P', value: Number(p.toFixed(2)), goal: Number(pGoal.toFixed(2)), color: '#7cb342' },
      { id: 'C', label: 'C', value: Number(c.toFixed(2)), goal: Number(cGoal.toFixed(2)), color: '#7cb342' },
      { id: 'GP', label: 'GP', value: Number(gp.toFixed(2)), color: '#545454' },
      { id: 'GC', label: 'GC', value: Number(gc.toFixed(2)), color: '#a8a8a8' },
    ];

    return {
      total: {
        title: 'Total',
        scheduled: Number(totalScheduledFee.toFixed(2)),
        scheduledVisits: totalScheduledVisits,
        rows: formatRows(totalP, totalC, totalGP, totalGC, totalPGoal, totalCGoal),
        perHour: totalPerHour,
        perHourGoal: Math.round(totalPerHourGoal * 100) / 100,
        perVisit: totalPerVisit,
        perVisitGoal: Math.round(totalVisitGoal * 100) / 100,
      },
      dentist: {
        title: 'Dentist',
        scheduled: Number(dentistScheduledFee.toFixed(2)),
        scheduledVisits: dentistScheduledVisits,
        rows: formatRows(dentistP, dentistC, dentistGP, dentistGC, dentistPGoal, dentistCGoal),
        perHour: dentistPerHour,
        perHourGoal: dentistHourlyGoal,
        perVisit: dentistPerVisit,
        perVisitGoal: dentistVisitGoal,
      },
      hygienist: {
        title: 'Hygienist',
        scheduled: Number(hygienistScheduledFee.toFixed(2)),
        scheduledVisits: hygienistScheduledVisits,
        rows: formatRows(hygienistP, hygienistC, hygienistGP, hygienistGC, hygienistPGoal, hygienistCGoal),
        perHour: hygienistPerHour,
        perHourGoal: hygienistHourlyGoal,
        perVisit: hygienistPerVisit,
        perVisitGoal: hygienistVisitGoal,
      },
    };
  }
}

export const productivityService = new ProductivityService();
