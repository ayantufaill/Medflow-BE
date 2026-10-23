/**
 * Secondary payment estimate tests.
 *
 * The arithmetic matters because these numbers are read out to a patient at
 * check-out. The behaviour that matters MOST is the UNKNOWN case: a plan whose
 * coordination method nobody has confirmed must produce a range, never a
 * confident single figure.
 */
import { describe, it, expect } from 'vitest';
import {
  COB_PAYMENT_METHODS,
  estimateForMethod,
  estimateRange,
  estimateSecondaryPayment,
  isEstimateRange,
} from '../src/services/cob/estimate';

/**
 * $1,000 billed, $800 allowed by the secondary, primary paid $500 and left
 * $300 of patient responsibility. The secondary covers 80%.
 */
const base = {
  billedAmount: 1000,
  allowedAmount: 800,
  primaryPaid: 500,
  primaryPatientResponsibility: 300,
  secondaryCoveragePercent: 80,
  secondaryDeductibleRemaining: 0,
};

describe('STANDARD coordination', () => {
  it('pays its own benefit less what the primary paid', () => {
    // Own benefit 80% of 800 = 640. Primary paid 500. Gap 140.
    const estimate = estimateForMethod('STANDARD', base);
    expect(estimate.estimatedPayment).toBe(140);
    expect(estimate.estimatedPatientResponsibility).toBe(160);
  });

  it('never exceeds what the patient was actually left owing', () => {
    // Paying more than the patient owes would be collecting twice for the
    // same money.
    const estimate = estimateForMethod('STANDARD', {
      ...base,
      primaryPatientResponsibility: 50,
    });
    expect(estimate.estimatedPayment).toBe(50);
    expect(estimate.estimatedPatientResponsibility).toBe(0);
  });

  it('pays nothing when the primary already paid more than its benefit', () => {
    const estimate = estimateForMethod('STANDARD', { ...base, primaryPaid: 900 });
    expect(estimate.estimatedPayment).toBe(0);
  });
});

describe('NON_DUPLICATION', () => {
  it('pays nothing when the primary matched its benefit — and says why', () => {
    // The method that surprises patients: a generous primary leaves the
    // secondary paying zero on a balance the patient then owes.
    const estimate = estimateForMethod('NON_DUPLICATION', { ...base, primaryPaid: 640 });
    expect(estimate.estimatedPayment).toBe(0);
    expect(estimate.estimatedPatientResponsibility).toBe(300);
    expect(estimate.explanation).toContain('pays nothing');
  });

  it('pays only the excess of its benefit over the primary payment', () => {
    const estimate = estimateForMethod('NON_DUPLICATION', base);
    expect(estimate.estimatedPayment).toBe(140);
  });
});

describe('CARVE_OUT', () => {
  it('computes the benefit on the allowed amount, then subtracts the primary', () => {
    // 80% of 800 = 640, less the primary's 500 = 140, capped at 300.
    const estimate = estimateForMethod('CARVE_OUT', base);
    expect(estimate.estimatedPayment).toBe(140);
    expect(estimate.explanation).toContain('allowed amount');
  });

  it('ignores the secondary deductible, unlike the standard method', () => {
    // Carve-out works off the allowable, which is why it pays more than
    // standard when a deductible is outstanding.
    const withDeductible = { ...base, secondaryDeductibleRemaining: 200 };
    expect(estimateForMethod('CARVE_OUT', withDeductible).estimatedPayment).toBe(140);
    expect(estimateForMethod('STANDARD', withDeductible).estimatedPayment).toBe(0);
  });
});

describe('REMAINING_BALANCE', () => {
  it('pays what the primary left of the allowed amount, up to its own benefit', () => {
    // Allowed 800 less primary 500 = 300 left; own benefit 640; patient owes
    // 300. So 300.
    const estimate = estimateForMethod('REMAINING_BALANCE', base);
    expect(estimate.estimatedPayment).toBe(300);
    expect(estimate.estimatedPatientResponsibility).toBe(0);
  });

  it('is capped by its own benefit, not just by the balance', () => {
    const estimate = estimateForMethod('REMAINING_BALANCE', {
      ...base,
      secondaryCoveragePercent: 20,
      primaryPaid: 100,
      primaryPatientResponsibility: 700,
    });
    // Own benefit 20% of 800 = 160, which is less than the 700 left.
    expect(estimate.estimatedPayment).toBe(160);
  });
});

describe('UNKNOWN method returns a RANGE', () => {
  it('gives min and max across the four methods, not a single number', () => {
    const result = estimateSecondaryPayment('UNKNOWN', base);
    expect(isEstimateRange(result)).toBe(true);
    if (!isEstimateRange(result)) throw new Error('expected a range');

    expect(result.minPayment).toBe(140);
    expect(result.maxPayment).toBe(300);
    expect(result.perMethod).toHaveLength(4);
    expect(result.explanation).toContain('between $140.00 and $300.00');
    expect(result.explanation).toContain('come from the remittance');
  });

  it('shows the per-method breakdown so a biller knows what to ask the payer', () => {
    const range = estimateRange({ ...base, primaryPaid: 640 });
    const nonDup = range.perMethod.find((m) => m.method === 'NON_DUPLICATION')!;
    const remaining = range.perMethod.find((m) => m.method === 'REMAINING_BALANCE')!;
    // $0 vs $160: a spread worth one phone call.
    expect(nonDup.estimatedPayment).toBe(0);
    expect(remaining.estimatedPayment).toBeGreaterThan(0);
    expect(range.minPayment).toBe(0);
  });

  it('collapses to a single value when every method happens to agree', () => {
    // A range is still a range — it just has zero width. The caller must not
    // have to special-case it.
    const range = estimateRange({ ...base, primaryPaid: 2000, primaryPatientResponsibility: 0 });
    expect(range.minPayment).toBe(0);
    expect(range.maxPayment).toBe(0);
  });

  it('reports patient responsibility as a range too', () => {
    const range = estimateRange(base);
    expect(range.minPatientResponsibility).toBe(0);
    expect(range.maxPatientResponsibility).toBe(160);
  });
});

describe('estimateSecondaryPayment dispatch', () => {
  it('returns a point estimate for a known method', () => {
    const result = estimateSecondaryPayment('STANDARD', base);
    expect(isEstimateRange(result)).toBe(false);
    expect(result.method).toBe('STANDARD');
  });

  it('covers exactly the four real methods in the range', () => {
    expect(COB_PAYMENT_METHODS).toEqual([
      'STANDARD',
      'NON_DUPLICATION',
      'CARVE_OUT',
      'REMAINING_BALANCE',
    ]);
  });
});

describe('degenerate inputs', () => {
  it('falls back to the billed amount when no allowed amount is known', () => {
    const estimate = estimateForMethod('CARVE_OUT', {
      ...base,
      allowedAmount: 0,
      primaryPatientResponsibility: 1000,
    });
    // 80% of the 1000 billed = 800, less the primary's 500 = 300.
    expect(estimate.estimatedPayment).toBe(300);
  });

  it('never returns a negative payment', () => {
    for (const method of COB_PAYMENT_METHODS) {
      const estimate = estimateForMethod(method, {
        ...base,
        primaryPaid: 5000,
        primaryPatientResponsibility: 0,
      });
      expect(estimate.estimatedPayment).toBeGreaterThanOrEqual(0);
    }
  });

  it('pays nothing when the primary left the patient owing nothing', () => {
    for (const method of COB_PAYMENT_METHODS) {
      const estimate = estimateForMethod(method, { ...base, primaryPatientResponsibility: 0 });
      expect(estimate.estimatedPayment).toBe(0);
    }
  });

  it('rounds to cents rather than carrying float noise into a quoted figure', () => {
    const estimate = estimateForMethod('STANDARD', {
      billedAmount: 100.33,
      allowedAmount: 100.33,
      primaryPaid: 33.11,
      primaryPatientResponsibility: 67.22,
      secondaryCoveragePercent: 70,
    });
    expect(estimate.estimatedPayment).toBe(Math.round(estimate.estimatedPayment * 100) / 100);
  });
});
