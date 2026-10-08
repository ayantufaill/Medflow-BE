/**
 * Date helpers for the COB rule engine.
 *
 * All of these work on ISO `YYYY-MM-DD` strings rather than Date objects.
 * That is not fussiness: `new Date('1985-03-10')` is midnight UTC, and in any
 * negative-offset timezone its `getMonth()`/`getDate()` are the 9th of March,
 * not the 10th. The birthday rule compares month and day, so a Date-based
 * implementation would silently rank the wrong parent primary for every
 * subscriber born on the 1st of a month. Strings have no zone to get wrong.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export interface YMD {
  year: number;
  month: number;
  day: number;
}

/** Parses the date part of an ISO string (or a Date). Null when unparseable. */
export const parseYmd = (value: string | Date | null | undefined): YMD | null => {
  if (!value) return null;
  const text =
    value instanceof Date
      ? // toISOString is UTC, which is correct here: we only ever store @db.Date
        // values, and Prisma hands those back as UTC midnight.
        value.toISOString().slice(0, 10)
      : String(value);
  const match = ISO_DATE.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!month || month > 12 || !day || day > 31) return null;
  return { year, month, day };
};

/** Normalizes any accepted date input to `YYYY-MM-DD`, or null. */
export const toIsoDate = (value: string | Date | null | undefined): string | null => {
  const ymd = parseYmd(value);
  if (!ymd) return null;
  return `${String(ymd.year).padStart(4, '0')}-${String(ymd.month).padStart(2, '0')}-${String(
    ymd.day
  ).padStart(2, '0')}`;
};

/** Negative when a < b. Plain string compare is correct for zero-padded ISO. */
export const compareIsoDate = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * Compares month/day only — the birthday rule ignores the year, because it
 * ranks by whose birthday falls earlier in the calendar, not who is older.
 */
export const compareMonthDay = (a: YMD, b: YMD): number => {
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
};

/** Whole calendar months from `from` to `to`; negative if `to` precedes it. */
export const monthsBetween = (from: YMD, to: YMD): number => {
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.day < from.day) months -= 1;
  return months;
};

/**
 * Is a coverage in force on the date of service?
 *
 * A missing effective date is treated as "in force from the beginning" and a
 * missing termination date as "still in force" — the common data state for a
 * policy entered without dates. Deliberately permissive: excluding a coverage
 * the patient actually holds would send the claim to the wrong payer, whereas
 * including one that has lapsed surfaces as a payer denial we can see.
 */
export const isActiveOn = (
  effectiveDate: string | null,
  terminationDate: string | null,
  dateOfService: string
): boolean => {
  if (effectiveDate && compareIsoDate(dateOfService, effectiveDate) < 0) return false;
  if (terminationDate && compareIsoDate(dateOfService, terminationDate) > 0) return false;
  return true;
};

/** `YYYY-MM-DD` one day before the given date. Used to close an order's range. */
export const dayBefore = (iso: string): string => {
  const ymd = parseYmd(iso);
  if (!ymd) return iso;
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
