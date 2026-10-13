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

