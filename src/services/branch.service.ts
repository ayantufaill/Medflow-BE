import { prisma } from '../config/db';
import { BadRequestError, NotFoundError, AuthorizationError } from '../utils/error.util';

// Matches the AptStatus convention in src/utils/opendental-mappers.util.ts
// (mapAppointmentStatusFromDb) — the actively-maintained appointment CRUD path.
const APT_STATUS_COMPLETED = 1;
const APT_STATUS_NO_SHOW = 3;
const APT_STATUS_CANCELLED = 4;

// clinic.IsHidden is nullable, and most rows are NULL rather than 0 — a plain
// `NOT: { IsHidden: 1 }` excludes NULLs too (SQL three-valued logic), which
// would hide every clinic that's never had IsHidden explicitly set to 0.
const NOT_HIDDEN_FILTER = { OR: [{ IsHidden: null }, { IsHidden: { not: 1 } }] };

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface BranchSummary {
  id: string;
  name: string;
  city: string | null;
}

interface MonthBucket {
  label: string;
  start: Date;
  end: Date; // exclusive
}

interface BranchAnalyticsQuery {
  clinicIds: bigint[];
  branchId?: string;
  startDate?: string;
  endDate?: string;
}

function formatCity(city: string | null, state: string | null): string | null {
  if (!city) return null;
  return state ? `${city}, ${state}` : city;
}

function parseClinicNum(branchId: string): bigint {
  if (!/^\d+$/.test(branchId)) {
    throw new BadRequestError(`Invalid branch id "${branchId}".`);
  }
  return BigInt(branchId);
}

/** Resolves the [start, end] window: explicit startDate/endDate, or the current calendar year. */
function resolveDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const end = endDate
      ? new Date(endDate)
      : new Date(Date.UTC(new Date().getUTCFullYear(), 11, 31, 23, 59, 59, 999));
    return { start, end };
  }
  const year = new Date().getUTCFullYear();
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

/** Calendar-month buckets spanning [start, end] inclusive, labeled Jan/Feb/... */
function getMonthBuckets(start: Date, end: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    buckets.push({
      label: MONTH_LABELS[month],
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return buckets;
}

function bucketIndexFor(date: Date, buckets: MonthBucket[]): number {
  const t = date.getTime();
  return buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
}

export class BranchService {
  /**
   * Branches the caller may access. When `clinicIds` is empty (no `userclinic`
   * assignments resolved for this caller — branches not configured for them
   * yet), falls back to every non-hidden clinic, matching the same
   * backward-compatible convention used for patient list scoping.
   */
  async getBranches(clinicIds: bigint[]): Promise<BranchSummary[]> {
    const where: any = { ...NOT_HIDDEN_FILTER };
    if (clinicIds.length > 0) {
      where.ClinicNum = { in: clinicIds };
    }

    const clinics = await prisma.clinic.findMany({
      where,
      select: { ClinicNum: true, Description: true, City: true, State: true },
      orderBy: { Description: 'asc' },
    });

    return clinics.map((c) => ({
      id: c.ClinicNum.toString(),
      name: c.Description ?? `Branch ${c.ClinicNum}`,
      city: formatCity(c.City, c.State),
    }));
  }

  async getBranchAnalytics({ clinicIds, branchId, startDate, endDate }: BranchAnalyticsQuery) {
    const { start, end } = resolveDateRange(startDate, endDate);
    const buckets = getMonthBuckets(start, end);

    if (branchId && branchId !== 'all') {
      const requestedClinicNum = parseClinicNum(branchId);
      const clinic = await prisma.clinic.findUnique({
        where: { ClinicNum: requestedClinicNum },
        select: { ClinicNum: true, Description: true, IsHidden: true },
      });
      if (!clinic || clinic.IsHidden === 1) {
        throw new NotFoundError('Branch not found.');
      }
      if (clinicIds.length > 0 && !clinicIds.includes(requestedClinicNum)) {
        throw new AuthorizationError('You do not have access to this branch.');
      }

      return this.buildSingleBranchStats(clinic.ClinicNum, clinic.Description, start, end, buckets);
    }

    // Aggregate across every clinic the caller may access (or all, if unscoped).
    const clinicWhere: any = { ...NOT_HIDDEN_FILTER };
    if (clinicIds.length > 0) clinicWhere.ClinicNum = { in: clinicIds };
    const targetClinics = await prisma.clinic.findMany({
      where: clinicWhere,
      select: { ClinicNum: true, Description: true },
    });
    const targetClinicNums = targetClinics.map((c) => c.ClinicNum);

    const appointments = await prisma.appointment.findMany({
      where: { ClinicNum: { in: targetClinicNums }, AptDateTime: { gte: start, lte: end } },
      select: { ClinicNum: true, AptStatus: true, AptDateTime: true },
    });

    const newPatients = await prisma.patient.count({
      where: { ClinicNum: { in: targetClinicNums }, DateFirstVisit: { gte: start, lte: end } },
    });

    const monthCounts = new Array(buckets.length).fill(0);
    let total = 0;
    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    const perClinic = new Map<string, { total: number; completed: number; cancelled: number; noShow: number }>();

    // Every appointment scheduled at the clinic in range counts toward the
    // total/monthly breakdown, regardless of patient/provider or status —
    // completed/cancelled/noShow below are informational subsets, not a filter.
    for (const apt of appointments) {
      total += 1;
      const key = apt.ClinicNum?.toString() ?? '';
      if (!perClinic.has(key)) perClinic.set(key, { total: 0, completed: 0, cancelled: 0, noShow: 0 });
      const bucket = perClinic.get(key)!;
      bucket.total += 1;

      if (apt.AptStatus === APT_STATUS_COMPLETED) {
        completed += 1;
        bucket.completed += 1;
      } else if (apt.AptStatus === APT_STATUS_CANCELLED) {
        cancelled += 1;
        bucket.cancelled += 1;
      } else if (apt.AptStatus === APT_STATUS_NO_SHOW) {
        noShow += 1;
        bucket.noShow += 1;
      }

      if (apt.AptDateTime) {
        const idx = bucketIndexFor(apt.AptDateTime, buckets);
        if (idx >= 0) monthCounts[idx] += 1;
      }
    }

    return {
      branchId: 'all',
      branchName: 'All Branches',
      totalAppointments: total,
      completed,
      cancelled,
      noShow,
      newPatients,
      appointmentsByMonth: buckets.map((b, i) => ({ month: b.label, appointments: monthCounts[i] })),
      byBranch: targetClinics.map((c) => {
        const stats = perClinic.get(c.ClinicNum.toString()) ?? { total: 0, completed: 0, cancelled: 0, noShow: 0 };
        return {
          branchId: c.ClinicNum.toString(),
          branchName: c.Description ?? `Branch ${c.ClinicNum}`,
          totalAppointments: stats.total,
          completed: stats.completed,
          cancelled: stats.cancelled,
          noShow: stats.noShow,
        };
      }),
    };
  }

  private async buildSingleBranchStats(
    clinicNum: bigint,
    description: string | null,
    start: Date,
    end: Date,
    buckets: MonthBucket[]
  ) {
    const appointments = await prisma.appointment.findMany({
      where: { ClinicNum: clinicNum, AptDateTime: { gte: start, lte: end } },
      select: { AptStatus: true, AptDateTime: true },
    });

    const newPatients = await prisma.patient.count({
      where: { ClinicNum: clinicNum, DateFirstVisit: { gte: start, lte: end } },
    });

    const monthCounts = new Array(buckets.length).fill(0);
    let total = 0;
    let completed = 0;
    let cancelled = 0;
    let noShow = 0;

    // Every appointment scheduled at the clinic in range counts, regardless
    // of patient/provider or status — completed/cancelled/noShow are subsets.
    for (const apt of appointments) {
      total += 1;
      if (apt.AptStatus === APT_STATUS_COMPLETED) completed += 1;
      else if (apt.AptStatus === APT_STATUS_CANCELLED) cancelled += 1;
      else if (apt.AptStatus === APT_STATUS_NO_SHOW) noShow += 1;

      if (apt.AptDateTime) {
        const idx = bucketIndexFor(apt.AptDateTime, buckets);
        if (idx >= 0) monthCounts[idx] += 1;
      }
    }

    return {
      branchId: clinicNum.toString(),
      branchName: description ?? `Branch ${clinicNum}`,
      totalAppointments: total,
      completed,
      cancelled,
      noShow,
      newPatients,
      appointmentsByMonth: buckets.map((b, i) => ({ month: b.label, appointments: monthCounts[i] })),
    };
  }
}

export const branchService = new BranchService();
