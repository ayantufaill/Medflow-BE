/**
 * Coverage-limits engine (pure).
 *
 * Consumes a persisted `coverageBookData` array and answers whether a line is
 * blocked by the plan's coverage book: not-covered, age, frequency, waiting or
 * lifetime caps. No Prisma/Express imports — the pricing loop owns fetching the
 * usage history and updating the running tally.
 *
 * Date handling is deliberately UTC/date-only. A local-time `Date` would shift a
 * day across time zones and break the frequency boundary (a service exactly N
 * months back must NOT be counted), so every comparison is done on UTC
 * midnight-anchored dates.
 */
import { normalizeCode, toAmount } from './deductible.service';
import { parseTeethLimit } from './downgrade.service';

/** A frequency rule: `count` services allowed per rolling `months` window. */
export type FrequencyRule = { count: number; months: number };

export type CoverageRule = {
  code: string;
  notCovered: boolean;
  /** Maximum age covered (inclusive); null = no age limit. */
  ageLimit: number | null;
  frequency: FrequencyRule | null;
  /** Dollar cap on total insurance paid for this code; null = uncapped. */
  lifetimeLimit: number | null;
  /** Dollar amount the plan pays (deductible first); null = use the percent. */
  flatPlanPortion: number | null;
  /** Parsed tooth limit; per-tooth enforcement is deferred. */
  teethLimit: string[] | null;
};

export type UsageEntry = { date: Date | string; toothKeys?: string[] };

/**
 * Coerce any date-ish value to a UTC-midnight `Date` (date-only).
 *
 * Strings are read as calendar dates: `YYYY-MM-DD` is taken verbatim, a full ISO
 * timestamp keeps its UTC calendar day. `Date` inputs keep their UTC calendar
 * day (Prisma date fields are UTC). Invalid input yields an Invalid Date.
 */
export const toUtcDate = (value: Date | string | null | undefined): Date => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return new Date(NaN);
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    );
  }
  if (typeof value === 'string') {
    const datePart = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (datePart) {
      return new Date(
        Date.UTC(Number(datePart[1]), Number(datePart[2]) - 1, Number(datePart[3]))
      );
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date(NaN);
    return new Date(
      Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
    );
  }
  return new Date(NaN);
};

const daysInUtcMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/**
 * Add whole months, clamping the day to the target month's length.
 * Jan 31 + 1 month = Feb 28 (Feb 29 in a leap year). UTC throughout.
 */
export const addMonths = (date: Date, months: number): Date => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = month + months;
  const targetYear = year + Math.floor(target / 12);
  const targetMonth = ((target % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInUtcMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
};

/** Completed years between `dob` and `onDate`, in UTC. Null when undeterminable. */
export const computeAge = (
  dob: Date | string | null | undefined,
  onDate: Date | string
): number | null => {
  if (dob === null || dob === undefined || dob === '') return null;
  const birth = toUtcDate(dob);
  const asOf = toUtcDate(onDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) return null;

  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
};

const toPositiveInt = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

/**
 * Parse a delivery pattern `"count / window unit"`, e.g. `"2/12 M"`, `"1/1 Y"`.
 * `Y` windows are converted to months. Returns null when either number is
 * missing or the string is malformed.
 */
export const parseDeliveryPattern = (raw: unknown): FrequencyRule | null => {
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^(\d*)\s*\/\s*(\d*)\s*([MY])?$/i);
  if (!match) return null;

  const count = toPositiveInt(match[1]);
  const window = toPositiveInt(match[2]);
  if (count === null || window === null) return null;

  const unit = (match[3] || 'M').toUpperCase();
  return { count, months: unit === 'Y' ? window * 12 : window };
};

/**
 * Frequency from the legacy split fields (`frequency1` = count, `frequency2` =
 * window, `period` = `M` | `Y`). Used only when `deliveryPattern` is absent.
 */
const frequencyFromFields = (row: Record<string, unknown>): FrequencyRule | null => {
  const count = toPositiveInt(row.frequency1);
  const window = toPositiveInt(row.frequency2);
  if (count === null || window === null) return null;
  const unit = String(row.period ?? 'M').trim().toUpperCase();
  return { count, months: unit === 'Y' ? window * 12 : window };
};

const isTruthyFlag = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1;

/** A positive money amount, or null when blank/zero/unparseable (treated as unset). */
const positiveMoney = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const amount = toAmount(value);
  return amount > 0 ? amount : null;
};

/**
 * Explicit money: blank/unparseable/negative → null (unset), but a typed `0` is
 * preserved. Used for `lifetimeLimit`, where a `$0` cap is meaningful — the plan
 * pays nothing for that code, so every line blocks.
 */
const explicitMoney = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed =
    typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
};

/**
 * Normalize a persisted `coverageBookData` array into rules keyed by CDT code.
 *
 * Rows look like:
 *   { code: 'D1206', nc: false, age: '18', deliveryPattern: '2/12 M',
 *     frequency1: '2', frequency2: '12', period: 'M', lifetimeLimit: '',
 *     flatPlanPortion: '', teethLimit: '' }
 *
 * Rows without a valid code are dropped. A duplicate code keeps the last row,
 * matching `buildDowngradeMap`. Blank numeric fields mean "unset" (no limit).
 */
export const normalizeCoverageLimits = (coverageBookData: unknown): Map<string, CoverageRule> => {
  const map = new Map<string, CoverageRule>();
  if (!Array.isArray(coverageBookData)) return map;

  const rows = coverageBookData.filter(
    (row): row is Record<string, unknown> =>
      !!row && typeof row === 'object' && !Array.isArray(row)
  );

  for (const row of rows) {
    const code = normalizeCode(row.code);
    if (!code) continue;

    const frequency =
      parseDeliveryPattern(row.deliveryPattern) ?? frequencyFromFields(row);

    map.set(code, {
      code,
      notCovered: isTruthyFlag(row.nc),
      ageLimit: toPositiveInt(row.age),
      frequency,
      lifetimeLimit: explicitMoney(row.lifetimeLimit),
      flatPlanPortion: positiveMoney(row.flatPlanPortion),
      teethLimit: parseTeethLimit(row.teethLimit) ?? null,
    });
  }

  return map;
};

/** True when the code is explicitly not covered. */
export const evaluateNotCovered = (rule: CoverageRule | null | undefined): boolean =>
  !!rule?.notCovered;

/**
 * True when the service falls inside the waiting period, i.e. strictly before
 * `policyStart + waitingMonths`. Skipped (false) when the waiting period or the
 * policy start is missing — we do not block on unknown data.
 */
export const evaluateWaiting = (
  waitingMonths: number | null | undefined,
  policyStart: Date | string | null | undefined,
  serviceDate: Date | string
): boolean => {
  if (waitingMonths === null || waitingMonths === undefined) return false;
  if (!Number.isFinite(waitingMonths) || waitingMonths <= 0) return false;
  if (policyStart === null || policyStart === undefined || policyStart === '') return false;

  const start = toUtcDate(policyStart);
  const service = toUtcDate(serviceDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(service.getTime())) return false;

  return service.getTime() < addMonths(start, waitingMonths).getTime();
};

/**
 * True when the patient is too old on the service date. Blocks only when
 * `age > ageLimit` (the limit itself is covered). A missing limit or unknown age
 * never blocks.
 */
export const evaluateAge = (
  rule: CoverageRule | null | undefined,
  ageOnServiceDate: number | null | undefined
): boolean => {
  if (!rule || rule.ageLimit === null) return false;
  if (ageOnServiceDate === null || ageOnServiceDate === undefined) return false;
  if (!Number.isFinite(ageOnServiceDate)) return false;
  return ageOnServiceDate > rule.ageLimit;
};

/**
 * True when the allowed count is already exhausted. Counts prior services in the
 * rolling window `(serviceDate − months, serviceDate]` — open on the left, so a
 * service exactly N months back is NOT counted. `toothKeys` is accepted for the
 * deferred per-tooth mode and ignored today.
 */
export const evaluateFrequency = (
  rule: CoverageRule | null | undefined,
  serviceDate: Date | string,
  prior: UsageEntry[] | null | undefined
): boolean => {
  if (!rule || !rule.frequency) return false;

  const service = toUtcDate(serviceDate);
  if (Number.isNaN(service.getTime())) return false;

  const windowStartMs = addMonths(service, -rule.frequency.months).getTime();
  const serviceMs = service.getTime();

  let used = 0;
  for (const entry of prior ?? []) {
    if (!entry || entry.date === null || entry.date === undefined) continue;
    const at = toUtcDate(entry.date).getTime();
    if (Number.isNaN(at)) continue;
    if (at > windowStartMs && at <= serviceMs) used += 1;
  }

  return used >= rule.frequency.count;
};

/** True when the lifetime dollar cap is already reached (`paid >= limit`). */
export const evaluateLifetime = (
  rule: CoverageRule | null | undefined,
  lifetimePaidToDate: number
): boolean => {
  if (!rule || rule.lifetimeLimit === null) return false;
  const paid = Number.isFinite(lifetimePaidToDate) ? lifetimePaidToDate : 0;
  return paid >= rule.lifetimeLimit;
};
