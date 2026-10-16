import { describe, expect, it } from 'vitest';
import { individualUsedSnapshot, remainingAnnualBenefit } from '../src/utils/insurance-benefit-usage.util';

const periodStart = new Date('2026-09-01T00:00:00.000Z');
const today = new Date('2026-10-15T12:00:00.000Z');

describe('individual benefit usage snapshots', () => {
  it('uses an undated saved amount without counting claims twice', () => {
    const snapshot = individualUsedSnapshot({ coverageLimits: { individual: { annualMax: '2000', usedAmount: '500', usedAmountDate: '' } } }, periodStart, today);
    expect(snapshot).toEqual({ amount: 500, claimsFrom: null });
    expect(remainingAnnualBenefit(2000, snapshot.amount ?? 0)).toBe(1500);
  });

  it('adds only claims after a dated snapshot', () => {
    const snapshot = individualUsedSnapshot({ coverageLimits: { individual: { usedAmount: '$500', usedAmountDate: '10/10/2026' } } }, periodStart, today);
    expect(snapshot.amount).toBe(500);
    expect(snapshot.claimsFrom?.toISOString()).toBe('2026-10-11T00:00:00.000Z');
  });

  it('uses claims from the plan year when no amount is saved or the snapshot has expired', () => {
    expect(individualUsedSnapshot({}, periodStart, today)).toEqual({ amount: null, claimsFrom: periodStart });
    expect(individualUsedSnapshot({ coverageLimits: { individual: { usedAmount: 500, usedAmountDate: '2026-08-31' } } }, periodStart, today))
      .toEqual({ amount: null, claimsFrom: periodStart });
  });

  it('preserves an explicit zero and does not add claims without a valid cutoff', () => {
    expect(individualUsedSnapshot({ coverageLimits: JSON.stringify({ individual: { usedAmount: 0 } }) }, periodStart, today))
      .toEqual({ amount: 0, claimsFrom: null });
  });
});
