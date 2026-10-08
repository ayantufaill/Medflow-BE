import { reportingClinicIds } from '../utils/reporting-scope.util';
import { normalizeReportingGoals, workingHoursInRange, productionGoal, collectionGoal, goalPercent, goalIsConfigured, goalLabel } from '../utils/reporting-goals.util';
import { recarePatientRows, countRecareCategories } from './recare-reporting.service';
import { prisma } from '../config/db';
import { getProvidersMeta } from '../utils/opendental-auth.util';

export interface MetricCard {
  pVal: number;
  pGoal: number;
  pPercent: number | null;
  cVal: number;
  cGoal: number;
  cPercent: number | null;
  gpVal: number;
  gpGoal: number;
  gpPercent: number | null;
  gcVal: number;
  gcGoal: number;
  gcPercent: number | null;
  perHourStr: string;
  perVisitStr: string;
}

export interface DashboardMetrics {
  total: MetricCard;
  dentist: MetricCard;
  hygienist: MetricCard;
  trends: {
    labels: string[];
    totalProduction: number[];
    treatmentProduction: number[];
    hygieneProduction: number[];
    totalProductionSummary?: { percent: string; footer: string };
    treatmentProductionSummary?: { percent: string; footer: string };
    hygieneProductionSummary?: { percent: string; footer: string };
  };
  patients: {
    txPt: { count: string; label: string; rows: { name: string; val: number }[] };
    hygPt: { count: string; label: string; rows: { name: string; val: number }[] };
    newPt: { count: string; label: string; rows: { name: string; val: number }[] };
  };
  caseAcceptance: {
    newPt: { acceptanceRate: string; summaryText: string; statuses: Record<string, number> };
    existingPt: { acceptanceRate: string; summaryText: string; statuses: Record<string, number> };
  };
  hygienePotential: {
    onTimeNoPreAppt: number;
    onTimePreAppt: number;
    noRecare: number;
    flaggedNoRecare: number;
    late12mAppt: number;
    late12mBroken: number;
    late12mNoAppt: number;
    lateUnder12mAppt: number;
    lateUnder12mBroken: number;
    lateUnder12mNoAppt: number;
  };
}

export interface DashboardGoals {
  dentistHourlyGoal: number;
  hygienistHourlyGoal: number;
  collectionPercentGoal: number;
  newPatientsGoal: number;
  monthlyVisitsGoal: number;
  hygieneVisitsPercent: number;
  treatmentVisitsPercent: number;
  reappointmentPercentGoal: number;
  newPtCaseAcceptPercent: number;
  existingPtCaseAcceptPercent: number;
  [key: string]: any;
}

export class DashboardMetricsService {
  /**
   * Fetch custom goals from the preference table or return defaults
   */
  async getDashboardGoals(): Promise<DashboardGoals> {
    const pref = await prisma.preference.findFirst({ where: { PrefName: 'DashboardGoals' } });
    return normalizeReportingGoals(pref?.ValueString ? JSON.parse(pref.ValueString) : {}) as DashboardGoals;
  }

  /**
   * Save custom goals to the preference table
   */
  async saveDashboardGoals(goals: Partial<DashboardGoals>): Promise<DashboardGoals> {
    const currentGoals = await this.getDashboardGoals();
    const updatedGoals = normalizeReportingGoals({ ...currentGoals, ...goals, configuredKeys: [...new Set([...(currentGoals.configuredKeys ?? []), ...Object.keys(goals).filter(key => key !== 'configuredKeys')])] }) as DashboardGoals;
    const valueString = JSON.stringify(updatedGoals);

    const existing = await prisma.preference.findFirst({
      where: { PrefName: 'DashboardGoals' },
    });

    if (existing) {
      await prisma.preference.update({
        where: { PrefNum: existing.PrefNum },
        data: { ValueString: valueString },
      });
    } else {
      // Find max PrefNum and increment
      const maxPref = await prisma.preference.findFirst({
        orderBy: { PrefNum: 'desc' },
      });
      const nextPrefNum = (maxPref?.PrefNum ?? BigInt(0)) + BigInt(1);

      await prisma.preference.create({
        data: {
          PrefNum: nextPrefNum,
          PrefName: 'DashboardGoals',
          ValueString: valueString,
          Comments: 'MedFlow Reports Dashboard Goals Settings',
        },
      });
    }

    return updatedGoals;
  }

  /**
   * Calculate dashboard metrics for the given date, range, and provider filter
   */
  async getDashboardMetrics(
    dateStr: string,
    range: string,
    providerId: string,
    customStart?: string,
    customEnd?: string,
    branchId?: string,
    groupId?: string,
    userId?: string
  ): Promise<DashboardMetrics> {
    const { startDate, endDate } = this.getRangeDates(dateStr, range, customStart, customEnd);
    const goals = await this.getDashboardGoals();

    // 0. Resolve target ClinicNums
    let targetClinicNums: bigint[] | undefined = undefined;
    if (branchId && branchId.toLowerCase() !== 'all') {
      targetClinicNums = [BigInt(branchId)];
    } else if (groupId && groupId !== 'All') {
      const clinics = await prisma.clinic.findMany({ where: { GroupNum: Number(groupId) }, select: { ClinicNum: true } });
      targetClinicNums = clinics.map(c => c.ClinicNum);
    }
    const allowedClinics = reportingClinicIds(branchId);
    targetClinicNums = targetClinicNums ? targetClinicNums.filter(id => allowedClinics === null || allowedClinics.includes(id)) : allowedClinics ?? undefined;

    // 1. Fetch & classify active providers
    const providers = await prisma.provider.findMany({
      where: { IsHidden: 0 },
      include: { 
        definition: true,
        providerclinic: true
      },
    });

    const dentistIds: bigint[] = [];
    const hygienistIds: bigint[] = [];
    const providerMap = new Map<string, { isHygienist: boolean; provNum: bigint }>();

    for (const p of providers) {
      // If clinic filter is active, only include providers who are attached to at least one of the target clinics
      if (targetClinicNums !== undefined) {
        const hasClinic = p.providerclinic.some(pc => pc.ClinicNum && targetClinicNums?.includes(pc.ClinicNum));
        if (!hasClinic) continue;
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

    // Apply provider filter
    let targetProvNums: bigint[] = [];
    let filterIsHygienist = false;
    let singleProviderMode = false;

    if (providerId && providerId !== 'All') {
      if (providerId === 'Hygienist') {
        targetProvNums = hygienistIds;
        filterIsHygienist = true;
      } else if (providerId === 'Dentist') {
        targetProvNums = dentistIds;
        filterIsHygienist = false;
      } else {
        const targetProv = providerMap.get(providerId);
        if (targetProv) {
          targetProvNums = [targetProv.provNum];
          filterIsHygienist = targetProv.isHygienist;
          singleProviderMode = true;
        } else {
          try {
            targetProvNums = [BigInt(providerId)];
          } catch {
            targetProvNums = [];
          }
        }
      }
    }

    if (!providerId || providerId.toLowerCase() === 'all') targetProvNums = [...providerMap.values()].map(p => p.provNum);

    // 2. Query Completed & Planned Procedures
    const completedProcs = await prisma.procedurelog.findMany({
      where: {
        ProcDate: { gte: startDate, lte: endDate },
        ProcStatus: 2, // Completed
        ProvNum: { in: targetProvNums },
        ...(targetClinicNums !== undefined ? { ClinicNum: { in: targetClinicNums } } : {}),
      },
    });

    const plannedProcs = await prisma.procedurelog.findMany({
      where: {
        ProcDate: { gte: startDate, lte: endDate },
        ProcStatus: 1, // Planned
        ProvNum: { in: targetProvNums },
        ...(targetClinicNums !== undefined ? { ClinicNum: { in: targetClinicNums } } : {}),
      },
    });

    // Sum production
    let totalCompletedVal = 0;
    let totalPlannedVal = 0;
    let dentistCompletedVal = 0;
    let dentistPlannedVal = 0;
    let hygienistCompletedVal = 0;
    let hygienistPlannedVal = 0;

    const treatmentPatientNums = new Set<string>();
    const hygienePatientNums = new Set<string>();

    for (const proc of completedProcs) {
      const fee = proc.ProcFee ?? 0;
      totalCompletedVal += fee;
      const provStr = proc.ProvNum?.toString() || '';
      const target = providerMap.get(provStr);
      if (target?.isHygienist) {
        hygienistCompletedVal += fee;
        if (proc.PatNum) hygienePatientNums.add(proc.PatNum.toString());
      } else {
        dentistCompletedVal += fee;
        if (proc.PatNum) treatmentPatientNums.add(proc.PatNum.toString());
      }
    }

    for (const proc of plannedProcs) {
      const fee = proc.ProcFee ?? 0;
      totalPlannedVal += fee;
      const provStr = proc.ProvNum?.toString() || '';
      const target = providerMap.get(provStr);
      if (target?.isHygienist) {
        hygienistPlannedVal += fee;
        if (proc.PatNum) hygienePatientNums.add(proc.PatNum.toString());
      } else {
        dentistPlannedVal += fee;
        if (proc.PatNum) treatmentPatientNums.add(proc.PatNum.toString());
      }
    }

    // If single provider mode, adjust total production cards to reflect filter
    if (singleProviderMode) {
      if (filterIsHygienist) {
        dentistCompletedVal = 0;
        dentistPlannedVal = 0;
      } else {
        hygienistCompletedVal = 0;
        hygienistPlannedVal = 0;
      }
    }

    // Query Collections (paysplit + claimproc)
    const paySplits = await prisma.paysplit.findMany({
      where: {
        DatePay: { gte: startDate, lte: endDate },
        IsDiscount: 0,
        ProvNum: { in: targetProvNums },
        ...(targetClinicNums !== undefined ? { ClinicNum: { in: targetClinicNums } } : {}),
      },
      select: { DatePay: true, SplitAmt: true, ProvNum: true },
    });

    const claimProcs = await prisma.claimproc.findMany({
      where: {
        DateCP: { gte: startDate, lte: endDate },
        Status: { in: [1, 4] },
        ProvNum: { in: targetProvNums },
        ...(targetClinicNums !== undefined ? { ClinicNum: { in: targetClinicNums } } : {}),
      },
      select: { DateCP: true, InsPayAmt: true, ProvNum: true },
    });

    let totalCollectionVal = 0;
    let dentistCollectionVal = 0;
    let hygienistCollectionVal = 0;

    for (const split of paySplits) {
      const amt = split.SplitAmt ?? 0;
      totalCollectionVal += amt;
      const target = providerMap.get(split.ProvNum?.toString() || '');
      if (target?.isHygienist) hygienistCollectionVal += amt;
      else dentistCollectionVal += amt;
    }

    for (const cp of claimProcs) {
      const amt = cp.InsPayAmt ?? 0;
      totalCollectionVal += amt;
      const target = providerMap.get(cp.ProvNum?.toString() || '');
      if (target?.isHygienist) hygienistCollectionVal += amt;
      else dentistCollectionVal += amt;
    }

    if (singleProviderMode) {
      if (filterIsHygienist) {
        dentistCollectionVal = 0;
      } else {
        hygienistCollectionVal = 0;
      }
    }

    // 3. Compute Working Hours in Range
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
    let dentistWorkingHours = 0;
    let hygienistWorkingHours = 0;

    const providerNums = providers.map((p) => p.ProvNum);
    const providersMeta = await getProvidersMeta(providerNums);

    for (const p of providers) {
      const spec = p.definition?.ItemName?.toLowerCase() || '';
      const isHygienist = p.IsSecondary === 1 || spec.includes('hygiene') || spec.includes('hygienist');

      // Filter by provider filter
      if (!targetProvNums.includes(p.ProvNum)) {
        continue;
      }

      if (!providerMap.has(p.ProvNum.toString())) continue;
      // Check user preferences for working hours
      const meta = providersMeta[p.ProvNum.toString()] ?? {};
      const providerHours = workingHoursInRange(meta, startDate, endDate);

      if (isHygienist) {
        hygienistWorkingHours += providerHours;
      } else {
        dentistWorkingHours += providerHours;
      }
    }

    const totalWorkingHours = dentistWorkingHours + hygienistWorkingHours;

    // Scale Goals based on range duration
    // The goals in setting are hourly for providers, and monthly for visits/new patients.
    const scaledDentistCompletedGoal = productionGoal(dentistWorkingHours, goals.dentistHourlyGoal);
    const scaledDentistPlannedGoal = scaledDentistCompletedGoal;
    const scaledHygienistCompletedGoal = productionGoal(hygienistWorkingHours, goals.hygienistHourlyGoal);
    const scaledHygienistPlannedGoal = scaledHygienistCompletedGoal;

    const scaledTotalCompletedGoal = scaledDentistCompletedGoal + scaledHygienistCompletedGoal;
    const scaledTotalPlannedGoal = scaledDentistPlannedGoal + scaledHygienistPlannedGoal;

    // 4. Query Visits / Appointments
    const completedAppts = await prisma.appointment.findMany({
      where: {
        AptDateTime: { gte: startDate, lte: endDate },
        AptStatus: { in: [1, 2, 5] }, // Same visit scope as the productivity panel
        ProvNum: { in: targetProvNums },
        ...(targetClinicNums !== undefined ? { ClinicNum: { in: targetClinicNums } } : {}),
      },
    });

    let totalVisitsCount = completedAppts.length;
    let dentistVisitsCount = 0;
    let hygienistVisitsCount = 0;

    for (const appt of completedAppts) {
      const provStr = appt.ProvNum?.toString() || '';
      const target = providerMap.get(provStr);
      if (target?.isHygienist) {
        hygienistVisitsCount++;
      } else {
        dentistVisitsCount++;
      }
    }

    if (singleProviderMode) {
      if (filterIsHygienist) {
        dentistVisitsCount = 0;
      } else {
        hygienistVisitsCount = 0;
      }
    }

    const hourlyProdTotal = totalWorkingHours > 0 ? totalCompletedVal / totalWorkingHours : 0;
    const hourlyProdDentist = dentistWorkingHours > 0 ? dentistCompletedVal / dentistWorkingHours : 0;
    const hourlyProdHygienist = hygienistWorkingHours > 0 ? hygienistCompletedVal / hygienistWorkingHours : 0;

    const visitProdTotal = totalVisitsCount > 0 ? totalCompletedVal / totalVisitsCount : 0;
    const visitProdDentist = dentistVisitsCount > 0 ? dentistCompletedVal / dentistVisitsCount : 0;
    const visitProdHygienist = hygienistVisitsCount > 0 ? hygienistCompletedVal / hygienistVisitsCount : 0;

    const calcPercent = goalPercent;
    
    const buildCard = (
      completed: number, planned: number, collection: number, 
      completedGoal: number, plannedGoal: number, 
      hourly: number, hourlyGoal: number, 
      visit: number, visitGoal: number, hourlyConfigured: boolean, visitConfigured: boolean
    ): MetricCard => {
      const pVal = Number(completed.toFixed(2));
      const gpVal = Number((completed + planned).toFixed(2));
      const cVal = Number(collection.toFixed(2));
      const gcVal = cVal;

      const pGoal = Number(completedGoal.toFixed(2));
      const gpGoal = Number(plannedGoal.toFixed(2));
      const cGoal = collectionGoal(completedGoal, goals.collectionPercentGoal);
      const gcGoal = collectionGoal(gpGoal, goals.collectionPercentGoal);

      return {
        pVal, pGoal, pPercent: calcPercent(pVal, pGoal),
        cVal, cGoal, cPercent: calcPercent(cVal, cGoal),
        gpVal, gpGoal, gpPercent: calcPercent(gpVal, gpGoal),
        gcVal, gcGoal, gcPercent: calcPercent(gcVal, gcGoal),
        perHourStr: `$${hourly.toFixed(0)} (${goalLabel(hourlyGoal, hourlyConfigured)})`,
        perVisitStr: `$${visit.toFixed(0)} (${goalLabel(visitGoal, visitConfigured)})`,
      };
    };

    const totalCard = buildCard(
      totalCompletedVal, totalPlannedVal, totalCollectionVal,
      scaledTotalCompletedGoal, scaledTotalPlannedGoal,
      hourlyProdTotal, totalWorkingHours > 0 ? scaledTotalCompletedGoal / totalWorkingHours : 0,
      visitProdTotal, goals.totalVisitGoal ?? 0,
      goalIsConfigured(goals, 'dentistHourlyGoal') || goalIsConfigured(goals, 'hygienistHourlyGoal'), goalIsConfigured(goals, 'totalVisitGoal')
    );

    const dentistCard = buildCard(
      dentistCompletedVal, dentistPlannedVal, dentistCollectionVal,
      scaledDentistCompletedGoal, scaledDentistPlannedGoal,
      hourlyProdDentist, goals.dentistHourlyGoal,
      visitProdDentist, goals.dentistVisitGoal ?? 0,
      goalIsConfigured(goals, 'dentistHourlyGoal'), goalIsConfigured(goals, 'dentistVisitGoal')
    );

    const hygienistCard = buildCard(
      hygienistCompletedVal, hygienistPlannedVal, hygienistCollectionVal,
      scaledHygienistCompletedGoal, scaledHygienistPlannedGoal,
      hourlyProdHygienist, goals.hygienistHourlyGoal,
      visitProdHygienist, goals.hygienistVisitGoal ?? 0,
      goalIsConfigured(goals, 'hygienistHourlyGoal'), goalIsConfigured(goals, 'hygienistVisitGoal')
    );


    // 5. Trend Line Charts (Split dates range into 20 sub-intervals)
    const trendData = this.calculateTrends(
      startDate, endDate, range, completedProcs, providerMap, targetProvNums,
      scaledTotalCompletedGoal, scaledDentistCompletedGoal, scaledHygienistCompletedGoal
    );

    // 6. Patient Summary Blocks
    const allAppts = await prisma.appointment.findMany({
      where: {
        AptDateTime: { gte: startDate, lte: endDate },
        ProvNum: { in: targetProvNums },
      },
      include: {
        patient: { select: { DateFirstVisit: true } },
        procedurelog_procedurelog_AptNumToappointment: {
          select: { procedurecode_procedurelog_MedicalCodeToprocedurecode: { select: { ProcCode: true } } }
        }
      }
    });

    let txCompleted = 0, txInChair = 0, txRescheduled = 0;
    let hygRecare = 0, hygPerio = 0, hygNew = 0;
    let newScheduled = 0, newWalkIn = 0, newNoShow = 0;

    for (const appt of allAppts) {
      const isNewPatient = appt.patient?.DateFirstVisit && appt.AptDateTime
        ? new Date(appt.patient.DateFirstVisit).toISOString().split('T')[0] === new Date(appt.AptDateTime).toISOString().split('T')[0]
        : false;

      const target = providerMap.get(appt.ProvNum?.toString() || '');
      const isDentist = target && !target.isHygienist;
      const isHygienist = target?.isHygienist;

      if (isNewPatient) {
        if (appt.AptStatus === 3) newNoShow++; 
        else if (appt.AptStatus === 1) newWalkIn++; 
        else newScheduled++; 
      }

      if (isDentist) {
        if (appt.AptStatus === 1) txCompleted++;
        else if (appt.AptStatus === 4) txRescheduled++;
        else txInChair++; 
      }

      if (isHygienist) {
        const procs = appt.procedurelog_procedurelog_AptNumToappointment || [];
        const codes = procs.map((p: any) => p.procedurecode_procedurelog_MedicalCodeToprocedurecode?.ProcCode || '');
        const hasPerio = codes.some((c: string) => c.includes('D434') || c.includes('D4910'));
        
        if (isNewPatient) hygNew++;
        else if (hasPerio) hygPerio++;
        else hygRecare++;
      }
    }

    // 7. Case Acceptance Rates
    const caseAcceptance = await this.calculateCaseAcceptance(startDate, endDate, targetProvNums);

    // 8. Hygiene Potential Donut Chart
    const hygienePotential = await this.calculateHygienePotential(providerId && providerId.toLowerCase() !== 'all' ? targetProvNums : undefined, targetClinicNums ?? undefined, endDate);

    return {
      total: totalCard,
      dentist: dentistCard,
      hygienist: hygienistCard,
      trends: trendData,
      patients: {
        txPt: {
          count: (txCompleted + txInChair + txRescheduled).toString(),
          label: "Tx Pt",
          rows: [
            { name: "Completed", val: txCompleted },
            { name: "In chair", val: txInChair },
            { name: "Rescheduled", val: txRescheduled }
          ]
        },
        hygPt: {
          count: (hygRecare + hygPerio + hygNew).toString(),
          label: "Hyg Pt",
          rows: [
            { name: "Recare", val: hygRecare },
            { name: "Perio", val: hygPerio },
            { name: "New", val: hygNew }
          ]
        },
        newPt: {
          count: (newScheduled + newWalkIn + newNoShow).toString(),
          label: "New Pt",
          rows: [
            { name: "Scheduled", val: newScheduled },
            { name: "Walk-in", val: newWalkIn },
            { name: "No-show", val: newNoShow }
          ]
        }
      },
      caseAcceptance,
      hygienePotential,
    };
  }

  /**
   * Helper to compute sub-interval production trends for the line charts
   */
  private calculateTrends(
    startDate: Date,
    endDate: Date,
    range: string,
    procedures: any[],
    providerMap: Map<string, { isHygienist: boolean }>,
    targetProvNums: bigint[],
    totalGoal: number,
    txGoal: number,
    hygGoal: number
  ) {
    const trendPoints = (range === 'Monthly' || range === 'Yearly') ? 12 : 20;
    const intervalMs = (endDate.getTime() - startDate.getTime()) / trendPoints;

    const labels: string[] = [];
    const totalProd: number[] = [];
    const txProd: number[] = [];
    const hygProd: number[] = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < trendPoints; i++) {
      const segmentStart = new Date(startDate.getTime() + i * intervalMs);
      const segmentEnd = new Date(startDate.getTime() + (i + 1) * intervalMs);

      // Label generation
      if (range === 'Daily') {
        labels.push(`${segmentStart.getHours()}:00`);
      } else if (range === 'Weekly') {
        labels.push(segmentStart.toLocaleDateString('en-US', { weekday: 'short' }));
      } else if (range === 'Monthly') {
        labels.push(`Day ${segmentStart.getDate()}`);
      } else {
        // Yearly
        labels.push(monthNames[segmentStart.getMonth()] || '');
      }

      // Filter procedures completed in this segment
      const segmentProcs = procedures.filter((proc) => {
        const d = proc.ProcDate ? new Date(proc.ProcDate) : null;
        return d && d >= segmentStart && d < segmentEnd;
      });

      let total = 0;
      let tx = 0;
      let hyg = 0;

      for (const p of segmentProcs) {
        const fee = p.ProcFee ?? 0;
        total += fee;
        const target = providerMap.get(p.ProvNum?.toString() || '');
        if (target?.isHygienist) {
          hyg += fee;
        } else {
          tx += fee;
        }
      }

      totalProd.push(Number(total.toFixed(2)));
      txProd.push(Number(tx.toFixed(2)));
      hygProd.push(Number(hyg.toFixed(2)));
    }

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const actualTotal = sum(totalProd);
    const actualTx = sum(txProd);
    const actualHyg = sum(hygProd);

    const formatSummary = (actual: number, goal: number) => {
      const percent = goalPercent(actual, goal);
      return {
        percent: percent === null ? "\u2014" : `${percent}%`,
        footer: goal > 0 ? `Production Goal $${goal.toFixed(0)} - Actual $${actual.toFixed(0)} (${percent}%)` : `No active production goal - Actual $${actual.toFixed(0)}`
      };
    };

    return {
      labels,
      totalProduction: totalProd,
      treatmentProduction: txProd,
      hygieneProduction: hygProd,
      totalProductionSummary: formatSummary(actualTotal, totalGoal),
      treatmentProductionSummary: formatSummary(actualTx, txGoal),
      hygieneProductionSummary: formatSummary(actualHyg, hygGoal),
    };
  }

  /**
   * Helper to query and group Case Acceptance status percentages
   */
  private async calculateCaseAcceptance(
    startDate: Date,
    endDate: Date,
    targetProvNums: bigint[]
  ) {
    const plans = await prisma.treatplan.findMany({
      where: {
        DateTP: { gte: startDate, lte: endDate },
      },
      include: {
        patient_treatplan_PatNumTopatient: true,
        treatplanattach: {
          select: {
            procedurelog: { select: { ProcFee: true, ProcStatus: true } }
          }
        }
      },
    });

    const initStatusObj = () => ({
      scheduled: 0,
      acceptedInProgress: 0,
      completed: 0,
      acceptedNotScheduled: 0,
      presented: 0,
      diagnosed: 0,
      rejected: 0,
      followUp: 0,
      reviewed: 0,
    });

    const newPtStatuses: Record<string, number> = initStatusObj();
    const existingPtStatuses: Record<string, number> = initStatusObj();

    let newPtAcceptedAmount = 0;
    let existingPtAcceptedAmount = 0;

    for (const plan of plans) {
      // Derive status from TPStatus and linked procedure ProcStatus columns
      const procs = plan.treatplanattach || [];
      const procStatuses = procs
        .map((a: any) => a.procedurelog?.ProcStatus)
        .filter((s: any) => s !== null && s !== undefined);
      const tpStatus = plan.TPStatus ?? 0;

      let statusKey: string;

      if (procStatuses.includes(6)) {
        // Has at least one scheduled procedure
        statusKey = 'scheduled';
      } else if (procStatuses.length > 0 && procStatuses.every((s: number) => s === 2)) {
        // All linked procedures are completed
        statusKey = 'completed';
      } else if (procStatuses.some((s: number) => s === 2) && procStatuses.some((s: number) => s !== 2)) {
        // Some completed, some still planned — accepted & in progress
        statusKey = 'acceptedInProgress';
      } else if (tpStatus === 1) {
        // Inactive treatment plan — rejected/declined
        statusKey = 'rejected';
      } else if (tpStatus === 2) {
        // Saved treatment plan — accepted but not yet scheduled
        statusKey = 'acceptedNotScheduled';
      } else if (procStatuses.length > 0 && procStatuses.every((s: number) => s === 1)) {
        // All procedures are treatment-planned — presented to patient
        statusKey = 'presented';
      } else {
        // Active plan with no linked procedures or unknown state
        statusKey = 'diagnosed';
      }

      const isNewPt = plan.patient_treatplan_PatNumTopatient?.DateFirstVisit &&
        plan.patient_treatplan_PatNumTopatient.DateFirstVisit >= startDate &&
        plan.patient_treatplan_PatNumTopatient.DateFirstVisit <= endDate;

      const targetGroup = isNewPt ? newPtStatuses : existingPtStatuses;
      if (targetGroup[statusKey] !== undefined) {
        targetGroup[statusKey]++;
      } else {
        targetGroup.diagnosed++;
      }

      if (['scheduled', 'acceptedInProgress', 'acceptedNotScheduled', 'completed'].includes(statusKey)) {
        let planFee = 0;
        if (plan.treatplanattach) {
          for (const attach of plan.treatplanattach) {
            planFee += (attach.procedurelog?.ProcFee || 0);
          }
        }
        if (isNewPt) newPtAcceptedAmount += planFee;
        else existingPtAcceptedAmount += planFee;
      }
    }

    const calcAcceptance = (statuses: Record<string, number>, acceptedAmount: number) => {
      const acceptedCases = statuses.scheduled + statuses.acceptedInProgress + statuses.acceptedNotScheduled + statuses.completed;
      const totalPresented = Object.values(statuses).reduce((a, b) => a + b, 0);
      const rate = totalPresented > 0 ? (acceptedCases / totalPresented) * 100 : 0;
      
      return {
        acceptanceRate: `${rate.toFixed(2)}%`,
        summaryText: `(${acceptedCases} Patient/s · $${acceptedAmount.toFixed(0)} accepted)`,
        statuses
      };
    };

    return {
      newPt: calcAcceptance(newPtStatuses, newPtAcceptedAmount),
      existingPt: calcAcceptance(existingPtStatuses, existingPtAcceptedAmount),
    };
  }

  private mapCaseAcceptanceStatus(status: string): string {
    const s = status.toLowerCase().replace(/_/g, ' ');
    if (s.includes('sched') && s.includes('accept')) return 'acceptedNotScheduled';
    if (s.includes('sched') || s.includes('appt')) return 'scheduled';
    if (s.includes('progress') || s.includes('in-progress')) return 'acceptedInProgress';
    if (s.includes('comp') || s.includes('done')) return 'completed';
    if (s.includes('present')) return 'presented';
    if (s.includes('diagnos')) return 'diagnosed';
    if (s.includes('reject')) return 'rejected';
    if (s.includes('follow')) return 'followUp';
    if (s.includes('review')) return 'reviewed';
    return 'diagnosed';
  }

  /**
   * Helper to query and group Hygiene Interval recall potential
   */
  private async calculateHygienePotential(targetProvNums: bigint[] | undefined, clinicIds?: bigint[], asOf = new Date()) {
    return countRecareCategories(await recarePatientRows({ providerIds: targetProvNums, clinicIds, asOf }));
  }

  /**
   * Helper to parse range boundaries from input date
   */
  private getRangeDates(dateStr: string, range: string, customStart?: string, customEnd?: string): { startDate: Date; endDate: Date } {
    if (range === 'Custom' && customStart && customEnd) {
      const start = new Date(customStart);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(customEnd);
      end.setUTCHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }

    const baseDate = dateStr ? new Date(dateStr) : new Date();
    let startDate = new Date(baseDate);
    let endDate = new Date(baseDate);

    if (range === 'Daily') {
      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCHours(23, 59, 59, 999);
    } else if (range === 'Weekly') {
      // Start of week (Sunday)
      const day = baseDate.getUTCDay();
      startDate.setUTCDate(baseDate.getUTCDate() - day);
      startDate.setUTCHours(0, 0, 0, 0);

      // End of week (Saturday)
      endDate.setUTCDate(baseDate.getUTCDate() + (6 - day));
      endDate.setUTCHours(23, 59, 59, 999);
    } else if (range === 'Monthly') {
      startDate.setUTCDate(1);
      startDate.setUTCHours(0, 0, 0, 0);

      endDate.setUTCMonth(baseDate.getUTCMonth() + 1, 0);
      endDate.setUTCHours(23, 59, 59, 999);
    } else if (range === 'Yearly') {
      startDate.setUTCMonth(0, 1);
      startDate.setUTCHours(0, 0, 0, 0);

      endDate.setUTCMonth(11, 31);
      endDate.setUTCHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }

  private timeToMins(timeStr: string): number {
    const parts = timeStr.split(':');
    const h = Number.parseInt(parts[0] || '0', 10);
    const m = Number.parseInt(parts[1] || '0', 10);
    return h * 60 + m;
  }
}

export const dashboardMetricsService = new DashboardMetricsService();
