import { describe, it, expect } from 'vitest';
import {
  bucketFor,
  daysOutstanding,
  basisAmount,
  feeAmountFor,
  chargeKey,
  eligibleInvoices,
  isLateFeeTier,
  resolveTier,
  defaultRateFor,
  LATE_FEE_DEFAULT_RATES,
  outstandingSplit,
} from '../src/services/late-fee.service';

// The 30/60/90 late-fee tiers are exclusive bands: an invoice is only ever
// eligible for exactly one tier, so a 100-day invoice can never be charged
// twice in one action under two different tiers. These tests pin the boundary
// behaviour, because an off-by-one here silently mis-prices a patient's
// balance.

describe('late fee tier buckets', () => {
  it('is not late before the first threshold', () => {
    expect(bucketFor(0)).toBeNull();
    expect(bucketFor(1)).toBeNull();
    expect(bucketFor(29)).toBeNull();
  });

  it('puts the boundary day into its own tier', () => {
    // The exact threshold day is late; the day before is not.
    expect(bucketFor(30)).toBe(30);
    expect(bucketFor(60)).toBe(60);
    expect(bucketFor(90)).toBe(90);
  });

  it('keeps each tier exclusive across its whole band', () => {
    expect(bucketFor(31)).toBe(30);
    expect(bucketFor(59)).toBe(30);
    expect(bucketFor(61)).toBe(60);
    expect(bucketFor(89)).toBe(60);
    expect(bucketFor(91)).toBe(90);
  });

  it('sends a very old invoice only to the top tier, never to 30 or 60', () => {
    expect(bucketFor(100)).toBe(90);
    expect(bucketFor(3650)).toBe(90);
  });

  it('treats negative or non-numeric ages as not late', () => {
    expect(bucketFor(-5)).toBeNull();
    expect(bucketFor(NaN)).toBeNull();
  });

  it('validates tier values', () => {
    expect(isLateFeeTier(30)).toBe(true);
    expect(isLateFeeTier(45)).toBe(false);
    expect(isLateFeeTier('30')).toBe(false);
  });
});

describe('days outstanding', () => {
  const now = new Date('2026-05-20T17:30:00.000Z');

  it('counts whole days from the date sent', () => {
    expect(daysOutstanding('2026-04-20T00:00:00.000Z', now)).toBe(30);
    expect(daysOutstanding('2026-05-19T00:00:00.000Z', now)).toBe(1);
  });

  it('measures from midnight so a same-day invoice is not already a day late', () => {
    // DateSent is a @db.Date column, so it arrives at midnight UTC. Counting
    // from the current clock time would make this read as 0 only by luck of
    // the hour; measuring from midnight is what makes it deterministic.
    expect(daysOutstanding('2026-05-20T00:00:00.000Z', now)).toBe(0);
  });

  it('returns null when the invoice was never sent, so no clock runs', () => {
    expect(daysOutstanding(null, now)).toBeNull();
    expect(daysOutstanding(undefined, now)).toBeNull();
    expect(daysOutstanding('not-a-date', now)).toBeNull();
  });
});

describe('fee basis and amount', () => {
  const invoice = { id: '1', patientPortion: 80, balanceDue: 300 };

  it('uses the patient portion for the patient basis', () => {
    expect(basisAmount(invoice, 'patient')).toBe(80);
  });

  it('uses the invoice balance for the total basis', () => {
    expect(basisAmount(invoice, 'total')).toBe(300);
  });

  it('falls back to the patient portion when the total balance is zero', () => {
    expect(basisAmount({ ...invoice, balanceDue: 0 }, 'total')).toBe(80);
  });

  it('applies a flat rate as dollars', () => {
    expect(feeAmountFor(300, 'flat', 25)).toBe(25);
  });

  it('applies a percentage against that invoice own basis', () => {
    expect(feeAmountFor(300, 'percentage', 10)).toBe(30);
    expect(feeAmountFor(80, 'percentage', 2.5)).toBe(2);
  });

  it('rounds currency to cents', () => {
    expect(feeAmountFor(333.33, 'percentage', 7.5)).toBe(25);
  });

  it('charges nothing for a missing or non-positive rate', () => {
    expect(feeAmountFor(300, 'flat', 0)).toBe(0);
    expect(feeAmountFor(300, 'percentage', -5)).toBe(0);
    expect(feeAmountFor(300, 'flat', NaN)).toBe(0);
  });
});

describe('eligible invoices', () => {
  const now = new Date('2026-05-20T12:00:00.000Z');
  const sentDaysAgo = (days: number) =>
    new Date(now.getTime() - days * 86_400_000).toISOString();

  const invoices = [
    { id: '11', invoiceDate: sentDaysAgo(35), patientPortion: 100, balanceDue: 100 },
    { id: '12', invoiceDate: sentDaysAgo(70), patientPortion: 200, balanceDue: 200 },
    { id: '13', invoiceDate: sentDaysAgo(10), patientPortion: 300, balanceDue: 300 },
    { id: '14', invoiceDate: null, patientPortion: 400, balanceDue: 400 },
    { id: '15', invoiceDate: sentDaysAgo(100), patientPortion: 0, balanceDue: 0 },
  ];

  it('returns only invoices inside the requested tier band', () => {
    const tier30 = eligibleInvoices(invoices, 30, [], now).map((i) => i.id);
    expect(tier30).toEqual(['11']);

    const tier60 = eligibleInvoices(invoices, 60, [], now).map((i) => i.id);
    expect(tier60).toEqual(['12']);

    // A 100-day invoice belongs to the 90 tier and must not leak into 30 or 60.
    const tier90 = eligibleInvoices(invoices, 90, [], now).map((i) => i.id);
    expect(tier90).toEqual([]);
  });

  it('excludes an invoice that was never sent', () => {
    // '14' is 400 days past due but has no DateSent, so it has no clock.
    expect(eligibleInvoices(invoices, 90, [], now).map((i) => i.id)).not.toContain('14');
  });

  it('excludes an invoice with nothing owed', () => {
    expect(eligibleInvoices(invoices, 90, [], now).map((i) => i.id)).not.toContain('15');
  });

  it('flags an invoice that already owes this tier as already charged', () => {
    const charged = [{ sourceStatement: '11', tier: 30 as const, baseAmount: 100, feeAmount: 25 }];
    const result = eligibleInvoices(invoices, 30, charged, now);
    expect(result).toHaveLength(1);
    expect(result[0].alreadyCharged).toBe(true);
  });

  it('treats a fee charged at a different tier as not blocking this one', () => {
    // An invoice that aged from 30 into 60 may legitimately owe both fees.
    const charged = [{ sourceStatement: '11', tier: 30 as const, baseAmount: 100, feeAmount: 25 }];
    const aged = [
      { id: '11', invoiceDate: sentDaysAgo(65), patientPortion: 100, balanceDue: 100 },
    ];
    const result = eligibleInvoices(aged, 60, charged, now);
    expect(result).toHaveLength(1);
    expect(result[0].alreadyCharged).toBe(false);
  });

  it('keys a charge by source invoice and tier', () => {
    expect(chargeKey('11', 30)).toBe('11:30');
    expect(chargeKey('11', 30)).not.toBe(chargeKey('11', 60));
    expect(chargeKey('11', 30)).not.toBe(chargeKey('12', 30));
  });

  it('carries both balances through for the dialog', () => {
    const aged = [
      { id: '20', invoiceDate: sentDaysAgo(35), patientPortion: 75, balanceDue: 250 },
    ];
    const [row] = eligibleInvoices(aged, 30, [], now);
    expect(row.basisPatient).toBe(75);
    expect(row.basisTotal).toBe(250);
    expect(row.daysOutstanding).toBe(35);
  });
});
describe('un-tiered adjustments', () => {
  const now = new Date('2026-05-20T12:00:00.000Z');
  const sentDaysAgo = (days: number) =>
    new Date(now.getTime() - days * 86_400_000).toISOString();

  it('resolves an absent tier to "any overdue invoice"', () => {
    // flat-rate and percentage are not tiered, so they must not be rejected as
    // having an invalid tier.
    expect(resolveTier(undefined)).toBeNull();
    expect(resolveTier(null)).toBeNull();
    expect(resolveTier('')).toBeNull();
    expect(resolveTier('any')).toBeNull();
  });

  it('still rejects a tier that is present but wrong', () => {
    expect(resolveTier(45)).toBeUndefined();
    expect(resolveTier('thirty')).toBeUndefined();
  });

  it('accepts every overdue invoice when no tier is requested', () => {
    const invoices = [
      { id: '11', invoiceDate: sentDaysAgo(35), patientPortion: 100, balanceDue: 100 },
      { id: '12', invoiceDate: sentDaysAgo(70), patientPortion: 200, balanceDue: 200 },
      { id: '13', invoiceDate: sentDaysAgo(120), patientPortion: 300, balanceDue: 300 },
      { id: '14', invoiceDate: sentDaysAgo(5), patientPortion: 400, balanceDue: 400 },
    ];
    const ids = eligibleInvoices(invoices, null, [], now).map((i) => i.id);
    // The 5-day invoice is not yet late, so it stays out.
    expect(ids).toEqual(['11', '12', '13']);
  });

  it('reports the actual tier of each un-tiered row', () => {
    const invoices = [
      { id: '11', invoiceDate: sentDaysAgo(35), patientPortion: 100, balanceDue: 100 },
      { id: '12', invoiceDate: sentDaysAgo(70), patientPortion: 200, balanceDue: 200 },
    ];
    const rows = eligibleInvoices(invoices, null, [], now);
    expect(rows.map((r) => r.tier)).toEqual([30, 60]);
  });

  it('keys an un-tiered charge separately from a tiered one', () => {
    expect(chargeKey('11', null)).toBe('11:any');
    expect(chargeKey('11', null)).not.toBe(chargeKey('11', 30));
  });
});

describe('fixed tier rates', () => {
  it('charges the agreed amount per tier', () => {
    expect(defaultRateFor(30)).toBe(50);
    expect(defaultRateFor(60)).toBe(100);
    expect(defaultRateFor(90)).toBe(150);
  });

  it('keeps the tier map and the lookup helper in agreement', () => {
    expect(LATE_FEE_DEFAULT_RATES).toEqual({ 30: 50, 60: 100, 90: 150 });
  });

  it('has no default for an un-tiered adjustment', () => {
    // Flat rate / Percentage have no tier to read an amount from, so they must
    // not silently inherit the 30-day figure.
    expect(defaultRateFor(null)).toBeNull();
  });
});

describe('ledger-style outstanding split', () => {
  it('splits a patient-only invoice entirely to the patient', () => {
    const split = outstandingSplit({ balTotal: 250, insEst: 0, writeoffAmount: 0 });
    expect(split).toEqual({
      insuranceWriteOff: 0,
      patientRemaining: 250,
      insuranceRemaining: 0,
      totalOwing: 250,
    });
  });

  it('splits an invoice carrying a remaining insurance estimate', () => {
    const split = outstandingSplit({ balTotal: 300, insEst: 120, writeoffAmount: 0 });
    expect(split.insuranceRemaining).toBe(120);
    expect(split.patientRemaining).toBe(180);
    expect(split.totalOwing).toBe(300);
  });

  it('reports the insurance write-off alongside the amounts still owing', () => {
    const split = outstandingSplit({ balTotal: 180, insEst: 0, writeoffAmount: 400 });
    expect(split.insuranceWriteOff).toBe(400);
    // The write-off is informational and is already netted out of the balance,
    // so it must not be double-counted into what is still owed.
    expect(split.totalOwing).toBe(180);
    expect(split.patientRemaining).toBe(180);
  });

  it('always has patient + insurance equal to the total owing', () => {
    const cases = [
      { balTotal: 500, insEst: 125.55, writeoffAmount: 60 },
      { balTotal: 99.99, insEst: 99.99, writeoffAmount: 0 },
      { balTotal: 42, insEst: 0, writeoffAmount: 10 },
    ];
    for (const c of cases) {
      const s = outstandingSplit(c);
      expect(Number((s.patientRemaining + s.insuranceRemaining).toFixed(2))).toBe(s.totalOwing);
    }
  });

  it('never reports a negative patient balance when insurance exceeds the total', () => {
    const split = outstandingSplit({ balTotal: 50, insEst: 200, writeoffAmount: 0 });
    expect(split.patientRemaining).toBe(0);
    expect(split.insuranceRemaining).toBe(50);
    expect(split.totalOwing).toBe(50);
  });

  it('treats a fully settled invoice as nothing owing', () => {
    const split = outstandingSplit({ balTotal: 0, insEst: 0, writeoffAmount: 250 });
    expect(split).toEqual({
      insuranceWriteOff: 250,
      patientRemaining: 0,
      insuranceRemaining: 0,
      totalOwing: 0,
    });
  });
});
