import { BadRequestError } from './error.util';

export const goalKeys = ['dentistHourlyGoal', 'hygienistHourlyGoal', 'collectionPercentGoal', 'newPatientsGoal', 'monthlyVisitsGoal', 'hygieneVisitsPercent', 'treatmentVisitsPercent', 'reappointmentPercentGoal', 'newPtCaseAcceptPercent', 'existingPtCaseAcceptPercent', 'totalVisitGoal', 'dentistVisitGoal', 'hygienistVisitGoal'];
export function normalizeReportingGoals(raw: Record<string, any> = {}): Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestError('Invalid goals configuration');
  const keys = Array.isArray(raw.configuredKeys) ? raw.configuredKeys.filter((k: string) => goalKeys.includes(k)) : goalKeys.filter(k => raw[k] != null && raw[k] !== '');
  const result: Record<string, any> = { ...raw, configuredKeys: keys };
  for (const key of goalKeys) {
    const value = raw[key] == null || raw[key] === '' ? 0 : Number(raw[key]);
    if (!Number.isFinite(value) || value < 0 || ((key.includes('Percent') || key.endsWith('PercentGoal')) && value > 100)) throw new BadRequestError(`Invalid goal: ${key}`);
    result[key] = value;
  }
  return result;
}
export const goalIsConfigured = (goals: Record<string, any>, key: string): boolean => goals.configuredKeys?.includes(key) ?? goals[key] != null;
export const goalPercent = (actual: number, goal: number): number | null => goal > 0 ? Math.round(actual / goal * 100) : null;
export const productionGoal = (hours: number, hourlyGoal: number): number => Math.round(hours * hourlyGoal * 100) / 100;
export const collectionGoal = (production: number, percent: number): number => Math.round(production * percent) / 100;
export function workingHoursInRange(meta: Record<string, any>, start: Date, end: Date): number {
  const mins = (value: unknown) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value));
    return match && +match[1] < 24 && +match[2] < 60 ? +match[1] * 60 + +match[2] : null;
  };
  const byDay = new Map<number, number>();
  for (const day of Array.isArray(meta.workingHours) ? meta.workingHours : []) {
    const from = mins(day.startTime), to = mins(day.endTime);
    if (day.isAvailable && from !== null && to !== null) byDay.set(Number(day.dayOfWeek), Math.max(0, to - from) / 60);
  }
  let hours = 0;
  const day = new Date(start.toISOString().slice(0, 10) + 'T00:00:00Z');
  const last = new Date(end.toISOString().slice(0, 10) + 'T00:00:00Z');
  while (day <= last) { hours += byDay.get(day.getUTCDay()) ?? 0; day.setUTCDate(day.getUTCDate() + 1); }
  return hours;
}
export function goalLabel(value: number, configured: boolean): string {
  return !configured ? 'Goal not configured' : value === 0 ? 'Goal disabled' : `goal $${value.toFixed(0)}`;
}
