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
