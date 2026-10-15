export function annualMaximum(meta: Record<string, any>): number | null {
  const value = meta.annualMax ?? meta.coverageLimits?.individual?.annualMax ?? meta.coverageLimits?.annualMax ?? meta.individualAnnualMax;
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const amount = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
export function benefitPeriodStart(meta: Record<string, any>, on: Date): Date {
  const month = Number(meta.renewalMonth);
  const renewal = Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : 0;
  return new Date(Date.UTC(on.getUTCFullYear() - (on.getUTCMonth() < renewal ? 1 : 0), renewal, 1));
}
export const remainingAnnualBenefit = (maximum: number | null, used: number): number | null =>
  maximum === null ? null : Math.round(Math.max(0, maximum - used) * 100) / 100;

/** A manually entered used amount is a snapshot, not another claim payment. */
export function individualUsedSnapshot(
  meta: Record<string, any>,
  periodStart: Date,
  on: Date,
): { amount: number | null; claimsFrom: Date | null } {
  let limits = meta.coverageLimits;
  if (typeof limits === 'string') {
    try { limits = JSON.parse(limits); } catch { limits = null; }
  }
  const individual = limits?.individual;
  const rawAmount = individual?.usedAmount ?? meta.usedAmount;
  const amount = rawAmount === null || rawAmount === undefined || String(rawAmount).trim() === ''
    ? null : Number(String(rawAmount).replace(/[$,\s]/g, ''));
  if (amount === null || !Number.isFinite(amount) || amount < 0) {
    return { amount: null, claimsFrom: periodStart };
  }

  const rawDate = String(individual?.usedAmountDate ?? '').trim();
  const iso = /^\d{4}-\d{2}-\d{2}/.test(rawDate)
    ? rawDate.slice(0, 10)
    : (() => {
      const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(rawDate);
      return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : '';
    })();
  const snapshotDate = iso ? new Date(`${iso}T00:00:00.000Z`) : null;
  if (!snapshotDate || Number.isNaN(snapshotDate.getTime()) || snapshotDate.toISOString().slice(0, 10) !== iso || snapshotDate > on) {
    // Without a reliable cutoff, claim payments might already be in the snapshot.
    return { amount, claimsFrom: null };
  }
  if (snapshotDate < periodStart) return { amount: null, claimsFrom: periodStart };

  const claimsFrom = new Date(snapshotDate);
  claimsFrom.setUTCDate(claimsFrom.getUTCDate() + 1);
  return { amount, claimsFrom };
}
