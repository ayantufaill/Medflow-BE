/**
 * Downgrade (alternate benefit) engine tests.
 *
 * Covers the pure lookup rules plus the money split, which is where a wrong
 * implementation silently under-bills the patient: `applyDeductible` derives the
 * patient share from whatever basis it is given, so a downgrade basis must be
 * corrected afterwards via `applyDowngradeSplit`.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeTooth,
  parseTeethLimit,
  parseTeethRange,
  isToothAllowed,
  normalizeDowngradeRows,
  buildDowngradeMap,
  resolveDowngrade,
  applyDowngradeSplit,
} from '../src/services/downgrade.service';
import { DeductibleLedger, applyDeductible } from '../src/services/deductible.service';

const book = (...rows: Record<string, any>[]) => rows;

describe('normalizeTooth', () => {
  it('accepts universal numbers 1-32 in the permanent namespace', () => {
    expect(normalizeTooth('1')).toBe('P:1');
    expect(normalizeTooth('16')).toBe('P:16');
    expect(normalizeTooth(32)).toBe('P:32');
  });

  it('keeps primary teeth in their own namespace, NOT collapsing them onto 1-20', () => {
    // Mapping A -> 1 would let a limit of "1, 2, 3" silently match primary
    // teeth A, B and C, applying a downgrade to teeth the plan never covered.
    expect(normalizeTooth('A')).toBe('R:A');
    expect(normalizeTooth('a')).toBe('R:A');
    expect(normalizeTooth('T')).toBe('R:T');
    expect(normalizeTooth('A')).not.toBe(normalizeTooth('1'));
  });

  it('keeps supernumerary teeth distinct from both series', () => {
    expect(normalizeTooth('AS')).toBe('S:AS');
    expect(normalizeTooth('KS')).toBe('S:KS');
    expect(normalizeTooth('51')).toBe('A:51');
    expect(normalizeTooth('82')).toBe('A:82');
  });

  it('strips surface and arch qualifiers', () => {
    expect(normalizeTooth('3M')).toBe('P:3');
    expect(normalizeTooth('UR6')).toBe('P:6');
    expect(normalizeTooth('14MO')).toBe('P:14');
    expect(normalizeTooth('AM')).toBe('R:A');
  });

  it('rejects out-of-range, non-teeth, and multi-tooth tokens', () => {
    expect(normalizeTooth('33')).toBeNull();
    expect(normalizeTooth('0')).toBeNull();
    expect(normalizeTooth('50')).toBeNull();
    expect(normalizeTooth('LL')).toBeNull();
    expect(normalizeTooth('')).toBeNull();
    expect(normalizeTooth(null)).toBeNull();
    // A range is not a single tooth — the caller handles those.
    expect(normalizeTooth('1-3')).toBeNull();
  });
});

describe('parseTeethLimit', () => {
  it('returns null when no limit is configured', () => {
    expect(parseTeethLimit('')).toBeNull();
    expect(parseTeethLimit(null)).toBeNull();
    expect(parseTeethLimit([])).toBeNull();
  });

  it('parses a comma-separated string and an array', () => {
    expect(parseTeethLimit('1, 3, 14')).toEqual(['P:1', 'P:14', 'P:3']);
    expect(parseTeethLimit([3, '1', 14])).toEqual(['P:1', 'P:14', 'P:3']);
  });

  it('expands quadrant shorthand to its member teeth', () => {
    expect(parseTeethLimit('Q1')).toEqual([
      'P:1', 'P:2', 'P:3', 'P:4', 'P:5', 'P:6', 'P:7', 'P:8',
    ]);
  });

  it('keeps a mixed permanent/primary limit unambiguous', () => {
    expect(parseTeethLimit('1, A, 30')).toEqual(['P:1', 'P:30', 'R:A']);
  });

  it('drops unparseable tokens instead of throwing', () => {
    expect(parseTeethLimit('3, garbage, 14')).toEqual(['P:14', 'P:3']);
  });
});

describe('isToothAllowed', () => {
  it('allows every tooth when no limit is configured', () => {
    expect(isToothAllowed(null, 'P:3')).toBe(true);
    expect(isToothAllowed([], 'P:30')).toBe(true);
  });

  it('honours a configured limit', () => {
    expect(isToothAllowed(['P:1', 'P:2', 'P:3', 'P:14'], 'P:3')).toBe(true);
    expect(isToothAllowed(['P:1', 'P:2', 'P:3', 'P:14'], 'P:30')).toBe(false);
  });

  it('never matches across tooth namespaces', () => {
    // The regression this guards: a permanent-only limit must not admit
    // primary tooth A, and vice versa.
    expect(isToothAllowed(['P:1', 'P:2', 'P:3'], 'R:A')).toBe(false);
    expect(isToothAllowed(['R:A'], 'P:1')).toBe(false);
    // Only when the limit names that exact primary tooth.
    expect(isToothAllowed(['R:A', 'R:B'], 'R:A')).toBe(true);
    expect(isToothAllowed(['P:1'], 'A:51')).toBe(false);
  });

  it('refuses a toothless line when a limit exists', () => {
    // We cannot prove an unspecified tooth qualifies, so do not downgrade.
    expect(isToothAllowed(['P:1', 'P:2', 'P:3'], null)).toBe(false);
  });
});

describe('normalizeDowngradeRows', () => {
  it('builds a rule from a row with the flag on', () => {
    const rules = normalizeDowngradeRows(
      book({ code: 'D2740', hasDowngrade: true, downgrade: 'D2791', maxAllowed: '450' })
    );
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      code: 'D2740',
      downgradeCode: 'D2791',
      maxAllowed: 450,
    });
  });

  it('ignores rows with the flag off, a blank target, or a self-reference', () => {
    expect(
      normalizeDowngradeRows(
        book(
          { code: 'D2740', hasDowngrade: false, downgrade: 'D2791' },
          { code: 'D2750', hasDowngrade: true, downgrade: '' },
          { code: 'D2391', hasDowngrade: true, downgrade: 'D2391' },
          { code: 'CNAN3 e A', hasDowngrade: true, downgrade: 'D2391' },
          { code: 'D2393', hasDowngrade: true, downgrade: 'not-a-code' }
        )
      )
    ).toEqual([]);
  });

  it('tolerates a non-array payload', () => {
    expect(normalizeDowngradeRows(null)).toEqual([]);
    expect(normalizeDowngradeRows('nope')).toEqual([]);
  });

  it('reads the teeth limit off the downgrade row first', () => {
    const rules = normalizeDowngradeRows(
      book(
        { code: 'D2391', hasDowngrade: true, downgrade: 'D2140' },
        { code: 'D2140', teethLimit: '1, 2, 3' }
      )
    );
    expect(rules[0].teethLimit).toEqual(['P:1', 'P:2', 'P:3']);
    expect(rules[0].teethSource).toBe('downgrade-row');
  });

  it('falls back to the billed row when the downgrade row has no limit', () => {
    const rules = normalizeDowngradeRows(
      book(
        { code: 'D2392', hasDowngrade: true, downgrade: 'D2150', teethLimit: '4, 5, 6' },
        { code: 'D2150' }
      )
    );
    expect(rules[0].teethLimit).toEqual(['P:4', 'P:5', 'P:6']);
    expect(rules[0].teethSource).toBe('billed-row');
  });

  it('reports no limit when neither row carries one', () => {
    const rules = normalizeDowngradeRows(
      book(
        { code: 'D2740', hasDowngrade: true, downgrade: 'D2791' },
        { code: 'D2791' }
      )
    );
    expect(rules[0].teethLimit).toEqual([]);
    expect(rules[0].teethSource).toBe('none');
  });
});

describe('resolveDowngrade', () => {
  const map = buildDowngradeMap(
    book(
      { code: 'D2740', hasDowngrade: true, downgrade: 'D2791' },
      { code: 'D2391', hasDowngrade: true, downgrade: 'D2140' },
      { code: 'D2140', teethLimit: '1, 2, 3' }
    )
  );

  it('returns the rule for an unrestricted code', () => {
    expect(resolveDowngrade('D2740', map, 'P:30').rule?.downgradeCode).toBe('D2791');
    expect(resolveDowngrade('2740', map, 'P:30').rule?.downgradeCode).toBe('D2791');
  });

  it('returns no rule for a code with no rule', () => {
    expect(resolveDowngrade('D2394', map, 'P:3')).toEqual({ rule: null, skipped: null });
  });

  it('applies a tooth-limited rule only within its limit', () => {
    expect(resolveDowngrade('D2391', map, 'P:3').rule?.downgradeCode).toBe('D2140');
    expect(resolveDowngrade('D2391', map, 'P:14')).toEqual({ rule: null, skipped: 'tooth' });
  });

  it("reports 'tooth' distinctly so the caller can record downgradeSkipped", () => {
    // Without this the loop cannot tell "plan has no rule for D2391" apart from
    // "the rule exists but this tooth is excluded", and 'tooth' is never stored.
    expect(resolveDowngrade('D2391', map, 'P:14').skipped).toBe('tooth');
    expect(resolveDowngrade('D2391', map, 'P:3').skipped).toBeNull();
    // A toothless line against a limited rule is also a tooth exclusion.
    expect(resolveDowngrade('D2391', map, null).skipped).toBe('tooth');
  });

  it('matches a ranged procedure tooth against a single-tooth limit', () => {
    // `item.site` longer than 2 chars is a RANGE (invoice.service.ts:2228), so
    // the loop must expand it rather than pass the raw string through.
    expect(parseTeethRange('1-3')).toEqual(['P:1', 'P:2', 'P:3']);
    expect(parseTeethRange('30-32')).toEqual(['P:30', 'P:31', 'P:32']);

    // A range of teeth is allowed when the limit covers ANY member.
    expect(resolveDowngrade('D2391', map, 'P:1').rule).not.toBeNull();
    expect(parseTeethRange('12, 14')).toEqual(['P:12', 'P:14']);
    // A procedure spanning an excluded tooth must NOT downgrade.
    expect(resolveDowngrade('D2391', map, 'P:13').skipped).toBe('tooth');
  });

  it('returns no rule for a missing map, missing code, or non-CDT code', () => {
    expect(resolveDowngrade('D2740', null, 'P:3')).toEqual({ rule: null, skipped: null });
    expect(resolveDowngrade('D2740', new Map(), 'P:3')).toEqual({ rule: null, skipped: null });
    expect(resolveDowngrade('X1234', map, 'P:3')).toEqual({ rule: null, skipped: null });
  });

  it('does not chain — a downgrade target is never itself resolved', () => {
    const chained = buildDowngradeMap(
      book(
        { code: 'D2740', hasDowngrade: true, downgrade: 'D2791' },
        { code: 'D2791', hasDowngrade: true, downgrade: 'D2790' }
      )
    );
    // D2740 resolves one level only, to D2791 — never on to D2790.
    expect(resolveDowngrade('D2740', chained, 'P:3').rule?.downgradeCode).toBe('D2791');
  });
});

describe('applyDowngradeSplit', () => {
  it('bills the patient for the procedure done, not the substitute', () => {
    // Crown billed at $1200, contracted to $900, plan downgrades to a $300
    // buildup and pays 50% of it.
    const split = applyDowngradeSplit({
      charge: 1200,
      contractualWriteOff: 300,
      insurancePortion: 150,
    });
    // 1200 - 300 write-off - 150 insurance = 750 owed, NOT 150.
    expect(split.patientPortion).toBe(750);
    expect(split.coinsurance).toBe(750);
  });

  it('never returns a negative patient portion', () => {
    const split = applyDowngradeSplit({
      charge: 100,
      contractualWriteOff: 0,
      insurancePortion: 250,
    });
    expect(split.patientPortion).toBe(0);
  });

  it('tolerates missing amounts', () => {
    const split = applyDowngradeSplit({
      charge: undefined as any,
      contractualWriteOff: undefined as any,
      insurancePortion: undefined as any,
    });
    expect(split.patientPortion).toBe(0);
  });
});

describe('downgrade pricing against a real deductible ledger', () => {
  // A $2000 Basic-tier deductible. D2740 and its D2791 substitute are BOTH
  // category `restorative`, and the grid maps `restorative -> basic`, so both
  // resolve to this one pool — which is why passing the billed code to
  // applyDeductible keeps them together.
  const ledger = (metAmount = 0) =>
    new DeductibleLedger(
      [
        {
          type: 'Basic',
          lifetime: false,
          standard: false,
          individual: 2000,
          family: 2000,
          metAmount,
          metDate: '',
        },
      ],
      'individual'
    );

  it('charges the deductible exactly once on a downgraded line', () => {
    const dg = ledger();
    const normal = ledger();

    // Downgraded: insurance priced on the $300 substitute.
    const downgraded = applyDeductible(dg, 'D2740', 300, 50);
    // Not downgraded: same pool, full $900 allowed fee.
    const plain = applyDeductible(normal, 'D2740', 900, 50);

    expect(downgraded.deductibleApplied).toBe(300);
    expect(plain.deductibleApplied).toBe(900);
    // Both lines drew from the SAME pool, and each drained it exactly once. A
    // second applyDeductible call per line would double-charge; assert the
    // remaining balances instead, since a duplicate call finds 0 left and
    // silently applies nothing.
    expect(dg.remaining('basic')).toBe(1700);
    expect(normal.remaining('basic')).toBe(1100);
    expect(downgraded.deductibleRowKey).toBe(plain.deductibleRowKey);
  });

  it('splits a downgraded line so the patient still owes the real procedure', () => {
    const priced = applyDeductible(ledger(), 'D2740', 300, 50);
    // The whole $300 substitute fee is absorbed by the deductible.
    expect(priced.deductibleApplied).toBe(300);
    expect(priced.insurancePortion).toBe(0);
    // applyDeductible reports the patient owing 300 — based on the substitute.
    expect(priced.patientPortion).toBe(300);

    const split = applyDowngradeSplit({
      charge: 1200,
      contractualWriteOff: 300,
      insurancePortion: priced.insurancePortion,
    });
    // Without the correction the patient would owe 300. They owe 900.
    expect(split.patientPortion).toBe(900);
  });

  it('leaves an unflagged procedure priced exactly as before', () => {
    const priced = applyDeductible(ledger(), 'D2740', 900, 50);
    expect(priced.deductibleApplied).toBe(900);
    expect(priced.insurancePortion).toBe(0);
    expect(priced.patientPortion).toBe(900);
  });

  it('pays coinsurance once the deductible is met, still on the downgrade fee', () => {
    // $1900 met, so $100 remains and clears first.
    const priced = applyDeductible(ledger(1900), 'D2740', 300, 50);
    expect(priced.deductibleApplied).toBe(100);
    expect(priced.insurancePortion).toBe(100); // (300 - 100) * 50%

    const split = applyDowngradeSplit({
      charge: 1200,
      contractualWriteOff: 300,
      insurancePortion: priced.insurancePortion,
    });
    expect(split.patientPortion).toBe(800); // 1200 - 300 - 100
  });
});
