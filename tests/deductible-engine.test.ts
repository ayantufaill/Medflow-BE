import { describe, it, expect } from 'vitest';
import {
  DeductibleLedger,
  applyDeductible,
  mapCodeToCategory,
  categoryToDeductibleRow,
  deriveTypeKey,
  normalizeCode,
  normalizeDeductibleRows,
  normalizeDeductibleGrid,
  resolveDeductibleTier,
  orderIndexesByDate,
  splitSecondaryPortion,
  accumulateMetAmount,
  deriveDeductibleAmount,
} from '../src/services/deductible.service';

const row = (type: string, individual: number, extra: Record<string, any> = {}) => ({
  type,
  lifetime: false,
  standard: false,
  individual,
  family: individual,
  metAmount: 0,
  metDate: '',
  ...extra,
});

const price = (ledger: DeductibleLedger, code: string, allowed: number, percent: number) =>
  applyDeductible(ledger, code, allowed, percent);

describe('mapCodeToCategory', () => {
  it('maps CDT ranges to the 12 internal categories', () => {
    expect(mapCodeToCategory('D0120')).toBe('diagnostic');
    expect(mapCodeToCategory('0120')).toBe('diagnostic');
    expect(mapCodeToCategory('D1110')).toBe('preventative');
    expect(mapCodeToCategory('D1120')).toBe('preventative');
    expect(mapCodeToCategory('D2391')).toBe('restorative');
    expect(mapCodeToCategory('D3330')).toBe('endodontics');
    expect(mapCodeToCategory('D4341')).toBe('periodonticsbasic');
    expect(mapCodeToCategory('D4910')).toBe('periodonticsbasic');
    expect(mapCodeToCategory('D4346')).toBe('periodonticsbasic');
    expect(mapCodeToCategory('D4355')).toBe('periodonticsbasic');
    expect(mapCodeToCategory('D4920')).toBe('periodonticsbasic');
    expect(mapCodeToCategory('D4921')).toBe('periodonticsbasic');
    expect(mapCodeToCategory('D4342')).toBe('periodonticsbasic');
    expect(mapCodeToCategory('D4321')).toBe('periodonticsmajor');
    expect(mapCodeToCategory('D5270')).toBe('prosthodonticsremovable');
    expect(mapCodeToCategory('D5930')).toBe('maxillofacialprosthetics');
    expect(mapCodeToCategory('D6010')).toBe('implantservices');
    expect(mapCodeToCategory('D6250')).toBe('prosthodonticsfixed');
    expect(mapCodeToCategory('D7210')).toBe('oralsurgery');
    expect(mapCodeToCategory('D8680')).toBe('orthodontics');
    expect(mapCodeToCategory('D9972')).toBe('adjunctgeneral');
  });

  it('rejects non-CDT codes', () => {
    expect(mapCodeToCategory('')).toBeNull();
    expect(mapCodeToCategory(null)).toBeNull();
    expect(mapCodeToCategory('HMO')).toBeNull();
  });

  it('collapses 12 categories onto the 5 grid rows, with null = fall through to Standard', () => {
    expect(categoryToDeductibleRow('diagnostic')).toBeNull();
    expect(categoryToDeductibleRow('adjunctgeneral')).toBeNull();
    expect(categoryToDeductibleRow('preventative')).toBe('preventative');
    expect(categoryToDeductibleRow('restorative')).toBe('basic');
    expect(categoryToDeductibleRow('endodontics')).toBe('basic');
    expect(categoryToDeductibleRow('periodonticsbasic')).toBe('basic');
    expect(categoryToDeductibleRow('periodonticsmajor')).toBe('major');
    expect(categoryToDeductibleRow('oralsurgery')).toBe('major');
    expect(categoryToDeductibleRow('orthodontics')).toBe('orthodontics');
  });
});

describe('typeKey derivation', () => {
  it('derives category keys from free text', () => {
    expect(deriveTypeKey('Standard')).toBe('standard');
    expect(deriveTypeKey('Preventative')).toBe('preventative');
    expect(deriveTypeKey('Basic')).toBe('basic');
    expect(deriveTypeKey('Major')).toBe('major');
    expect(deriveTypeKey('Orthodontics')).toBe('orthodontics');
    expect(deriveTypeKey('  Orthodontics ')).toBe('orthodontics');
  });

  it('derives code keys without relying on the client-only isCodeRow flag', () => {
    expect(deriveTypeKey('D2140')).toBe('code:D2140');
    expect(deriveTypeKey('d2140')).toBe('code:D2140');
    expect(deriveTypeKey('2140')).toBe('code:D2140');
    expect(deriveTypeKey('Major')).not.toBe('code:D2140');
  });

  it('normalizes codes for lookup', () => {
    expect(normalizeCode('d2140')).toBe('D2140');
    expect(normalizeCode('2140')).toBe('D2140');
    expect(normalizeCode('nope')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The four worked examples from the specification.
// ---------------------------------------------------------------------------

describe('Example 1 — simple deductible on allowed fee', () => {
  it('applies deductible before coinsurance', () => {
    const ledger = new DeductibleLedger([row('Standard', 50)], 'individual');
    const r = price(ledger, 'D2740', 200, 80);

    expect(r.deductibleApplied).toBe(50);
    expect(r.afterDeductible).toBe(150);
    expect(r.insurancePortion).toBe(120);
    expect(r.coinsurance).toBe(30);
    expect(r.patientPortion).toBe(80);

    // patient = deductible + coinsurance
    expect(r.patientPortion).toBe(r.deductibleApplied + r.coinsurance);
    // totals reconcile to the allowed fee
    expect(r.insurancePortion + r.patientPortion).toBe(200);
  });

  it('allows a deductible larger than the initial coinsurance (the v1 formula bug)', () => {
    // Old formula capped ded at basisFee - insPortion = 200 - 160 = 40.
    const ledger = new DeductibleLedger([row('Standard', 50)], 'individual');
    const r = price(ledger, 'D2740', 200, 80);
    expect(r.deductibleApplied).toBeGreaterThan(200 * 0.2);
  });
});

describe('Example 2 — partially met deductible', () => {
  it('applies only the remaining balance and brings it to fully met', () => {
    const ledger = new DeductibleLedger(
      [row('Standard', 500, { metAmount: 300 })],
      'individual',
    );
    expect(ledger.remaining('standard')).toBe(200);

    const r = price(ledger, 'D2740', 600, 80);
    expect(r.deductibleApplied).toBe(200);
    expect(r.afterDeductible).toBe(400);
    expect(r.insurancePortion).toBe(320);
    expect(r.coinsurance).toBe(80);
    expect(r.patientPortion).toBe(280);
    expect(ledger.remaining('standard')).toBe(0);
  });
});

describe('Example 3 — running balance across procedures', () => {
  it('consumes the deductible once and does not reset per line', () => {
    const ledger = new DeductibleLedger([row('Standard', 300)], 'individual');

    const p1 = price(ledger, 'D1110', 100, 80);
    expect(p1.deductibleApplied).toBe(100);
    expect(p1.insurancePortion).toBe(0);
    expect(p1.patientPortion).toBe(100);
    expect(ledger.remaining('standard')).toBe(200);

    const p2 = price(ledger, 'D2391', 200, 80);
    expect(p2.deductibleApplied).toBe(200);
    expect(p2.insurancePortion).toBe(0);
    expect(p2.patientPortion).toBe(200);
    expect(ledger.remaining('standard')).toBe(0);

    const p3 = price(ledger, 'D2740', 500, 80);
    expect(p3.deductibleApplied).toBe(0);
    expect(p3.insurancePortion).toBe(400);
    expect(p3.coinsurance).toBe(100);
    expect(p3.patientPortion).toBe(100);

    const totalDed = p1.deductibleApplied + p2.deductibleApplied + p3.deductibleApplied;
    const totalIns = p1.insurancePortion + p2.insurancePortion + p3.insurancePortion;
    const totalPt = p1.patientPortion + p2.patientPortion + p3.patientPortion;

    expect(totalDed).toBe(300);
    expect(totalIns).toBe(400);
    expect(totalPt).toBe(400);
    // The deductible is a component of the patient portion, not additional to
    // it, so it reconciles against the allowed total alongside the split.
    expect(totalIns + totalPt).toBe(800);
    expect(totalDed).toBeLessThanOrEqual(totalPt);
  });
});

describe('Example 4 — provider charges more than allowed', () => {
  it('keeps the write-off outside the deductible base', () => {
    // billed 250, allowed 200, write-off 50
    const writeoff = 250 - 200;
    expect(writeoff).toBe(50);

    const ledger = new DeductibleLedger([row('Standard', 50)], 'individual');
    const r = price(ledger, 'D2740', 200, 80);

    expect(r.deductibleApplied).toBe(50);
    expect(r.insurancePortion).toBe(120);
    expect(r.coinsurance).toBe(30);

    // patient = writeoff + deductible + coinsurance
    const patient = writeoff + r.deductibleApplied + r.coinsurance;
    expect(patient).toBe(130);
    expect(patient + r.insurancePortion).toBe(250);
  });

  it('never lets the deductible reach into the write-off', () => {
    // allowed 200, write-off 50, deductible 500 -> capped at the allowed fee
    const ledger = new DeductibleLedger([row('Standard', 500)], 'individual');
    const r = price(ledger, 'D2740', 200, 80);
    expect(r.deductibleApplied).toBe(200);
    expect(r.insurancePortion).toBe(0);
    expect(r.patientPortion).toBe(200);
  });
});

describe('Case 5 — per-row pools are independent', () => {
  it('a Major procedure consumes the Major pool, never Standard', () => {
    const ledger = new DeductibleLedger(
      [
        row('Standard', 500, { metAmount: 200 }),
        row('Major', 1000, { metAmount: 400 }),
        row('Orthodontics', 2000, { metAmount: 500 }),
      ],
      'individual',
    );

    expect(ledger.remaining('standard')).toBe(300);
    expect(ledger.remaining('major')).toBe(600);
    expect(ledger.remaining('orthodontics')).toBe(1500);

    // D2740 is restorative -> Basic -> no Basic row -> falls through to Standard
    const basic = price(ledger, 'D2740', 100, 80);
    expect(basic.rowKey).toBe('standard');
    expect(ledger.remaining('standard')).toBe(200);

    // D7210 is fixed prosthodontics -> Major
    const major = price(ledger, 'D7210', 600, 50);
    expect(major.rowKey).toBe('major');
    expect(major.deductibleApplied).toBe(600);
    expect(ledger.remaining('major')).toBe(0);

    // Standard untouched by the Major procedure
    expect(ledger.remaining('standard')).toBe(200);
    // Orthodontics never touched
    expect(ledger.remaining('orthodontics')).toBe(1500);
  });

  it('resolves via exact CDT code before category', () => {
    const ledger = new DeductibleLedger(
      [row('Standard', 500), row('Major', 1000), row('D2740', 25, { isCodeRow: true })],
      'individual',
    );
    const r = price(ledger, 'D2740', 100, 80);
    expect(r.rowKey).toBe('code:D2740');
    expect(r.deductibleApplied).toBe(25);
    expect(ledger.remaining('standard')).toBe(500);
  });

  it('falls back to Standard when no category row exists', () => {
    const ledger = new DeductibleLedger([row('Standard', 500)], 'individual');
    expect(price(ledger, 'D2391', 100, 80).rowKey).toBe('standard');
    expect(price(ledger, 'D8680', 100, 80).rowKey).toBe('standard');
  });

  it('applies no deductible when no rows are configured', () => {
    const ledger = new DeductibleLedger([], 'individual');
    const r = price(ledger, 'D2740', 200, 80);
    expect(r.deductibleApplied).toBe(0);
    expect(r.insurancePortion).toBe(160);
    expect(r.patientPortion).toBe(40);
  });
});

describe('Case 6 — deterministic procedure ordering', () => {
  it('orders by date of service and keeps input order for ties', () => {
    const items = [
      { ProcDate: '2026-03-01' },
      { ProcDate: '2026-01-15' },
      { ProcDate: '2026-03-01' },
      { ProcDate: '2026-02-10' },
    ];
    expect(orderIndexesByDate(items)).toEqual([1, 3, 0, 2]);
  });

  it('sorts undated lines last, deterministically', () => {
    const items = [{ ProcDate: '2026-05-01' }, {}, { ProcDate: '2026-01-01' }, {}];
    expect(orderIndexesByDate(items)).toEqual([2, 0, 1, 3]);
  });

  it('is stable regardless of input array order', () => {
    const a = [{ ProcDate: '2026-01-01' }, { ProcDate: '2026-02-01' }, { ProcDate: '2026-03-01' }];
    const b = [a[2], a[0], a[1]];
    // Same multiset of dates -> same relative date order
    expect(orderIndexesByDate(a)).toEqual([0, 1, 2]);
    expect(orderIndexesByDate(b)).toEqual([1, 2, 0]);
  });

  it('allocates the same deductible totals whatever the input order', () => {
    const lines = [
      { code: 'D1110', allowed: 100 },
      { code: 'D2391', allowed: 200 },
      { code: 'D2740', allowed: 500 },
    ];
    const run = (input: typeof lines) => {
      const ledger = new DeductibleLedger([row('Standard', 300)], 'individual');
      return input
        .map((l) => price(ledger, l.code, l.allowed, 80))
        .reduce(
          (acc, r) => ({
            ded: acc.ded + r.deductibleApplied,
            ins: acc.ins + r.insurancePortion,
            pt: acc.pt + r.patientPortion,
          }),
          { ded: 0, ins: 0, pt: 0 },
        );
    };

    const forward = run(lines);
    const reversed = run([...lines].reverse());
    const shuffled = run([lines[1], lines[2], lines[0]]);

    for (const total of [forward, reversed, shuffled]) {
      expect(total.ded).toBe(300);
      expect(total.ins).toBe(400);
      expect(total.pt).toBe(400);
    }
  });
});

describe('Case 7 — secondary insurance receives coinsurance only', () => {
  it('keeps the deductible with the patient', () => {
    // ptPortion 80 = deductible 50 + coinsurance 30
    const split = splitSecondaryPortion(80, 50);
    expect(split.secondaryPortion).toBe(30);
    expect(split.patientPortion).toBe(50);
  });

  it('transfers the full portion when no deductible applied', () => {
    const split = splitSecondaryPortion(40, 0);
    expect(split.secondaryPortion).toBe(40);
    expect(split.patientPortion).toBe(0);
  });

  it('never transfers a negative or over-full amount', () => {
    expect(splitSecondaryPortion(0, 0)).toEqual({ secondaryPortion: 0, patientPortion: 0 });
    expect(splitSecondaryPortion(10, 999)).toEqual({ secondaryPortion: 0, patientPortion: 10 });
  });

  it('integrates end to end: deductible is excluded from the secondary claim', () => {
    const ledger = new DeductibleLedger([row('Standard', 50)], 'individual');
    const r = price(ledger, 'D2740', 200, 80);
    const split = splitSecondaryPortion(r.patientPortion, r.deductibleApplied);

    expect(r.deductibleApplied).toBe(50);
    expect(split.secondaryPortion).toBe(30);
    expect(split.patientPortion).toBe(50);
  });
});

describe('Case 8 — metAmount persists across separate claims', () => {
  it('does not double-apply the deductible on a second claim', () => {
    const grid = [row('Standard', 500, { metAmount: 0 })];

    // Claim 1: allowed 600
    const claim1 = new DeductibleLedger(grid, 'individual');
    const c1 = price(claim1, 'D2740', 600, 80);
    expect(c1.deductibleApplied).toBe(500);
    expect(c1.afterDeductible).toBe(100);
    expect(c1.insurancePortion).toBe(80);
    // patient = 500 deductible + 20 coinsurance
    expect(c1.patientPortion).toBe(520);

    // Persist metAmount
    const updated = accumulateMetAmount(grid, claim1.appliedByRow(), '2026-03-15');
    expect((updated as any[])[0].metAmount).toBe(500);
    expect((updated as any[])[0].metDate).toBe('2026-03-15');

    // Claim 2: allowed 600 -> nothing left to deduct
    const claim2 = new DeductibleLedger(updated, 'individual');
    const c2 = price(claim2, 'D2740', 600, 80);
    expect(c2.deductibleApplied).toBe(0);
    expect(c2.insurancePortion).toBe(480);
    expect(c2.patientPortion).toBe(120);

    // Total deductible across both claims never exceeds the plan
    const total = c1.deductibleApplied + c2.deductibleApplied;
    expect(total).toBe(500);
  });

  it('stamps metDate only on first application', () => {
    const grid = [row('Standard', 500, { metDate: '2026-01-10' })];
    const ledger = new DeductibleLedger(grid, 'individual');
    const r = price(ledger, 'D2740', 600, 80);
    const updated = accumulateMetAmount(grid, ledger.appliedByRow(), '2026-06-01');
    expect((updated as any[])[0].metDate).toBe('2026-01-10');
    expect((updated as any[])[0].metAmount).toBe(500);
  });

  it('never lets metAmount exceed the row limit', () => {
    const grid = [row('Standard', 500, { metAmount: 450 })];
    const ledger = new DeductibleLedger(grid, 'individual');
    const r = price(ledger, 'D2740', 600, 80);
    const updated = accumulateMetAmount(grid, ledger.appliedByRow(), '2026-03-15');
    expect((updated as any[])[0].metAmount).toBe(500);
  });

  it('accumulates per row independently', () => {
    const grid = [row('Standard', 500, { metAmount: 0 }), row('Major', 1000, { metAmount: 0 })];
    const ledger = new DeductibleLedger(grid, 'individual');
    price(ledger, 'D2740', 100, 80); // -> standard
    price(ledger, 'D7210', 250, 50); // -> major
    expect(ledger.appliedByRow()).toEqual({ standard: 100, major: 250 });

    const updated = accumulateMetAmount(grid, ledger.appliedByRow(), '2026-03-15') as any[];
    const std = updated.find((r) => r.typeKey === 'standard');
    const maj = updated.find((r) => r.typeKey === 'major');
    expect(std.metAmount).toBe(100);
    expect(maj.metAmount).toBe(250);
  });
});

describe('tier selection', () => {
  it('uses individual for a self-subscriber single-member plan', () => {
    expect(resolveDeductibleTier({ relationship: 'Self', patientsCovered: 1 })).toBe('individual');
    expect(resolveDeductibleTier({ patientsCovered: 1 })).toBe('individual');
  });

  it('uses family for spouse/child or multi-member plans', () => {
    expect(resolveDeductibleTier({ relationship: 'Spouse', patientsCovered: 1 })).toBe('family');
    expect(resolveDeductibleTier({ relationship: 'Self', patientsCovered: 3 })).toBe('family');
  });

  it('treats the numeric patplan Relationship enum 0 as Self', () => {
    // `patplan.Relationship` is the OpenDental enum (0=Self, 1=Spouse,
    // 2=Child, 3=Parent, 4=Other) and Prisma surfaces it as a BigInt. The
    // resolver used to string-match only 'self'/'sig', so `String(0n)` === '0'
    // never matched and every self-only plan silently resolved to the family
    // tier. That made the whole deductible resolve against `family`, which the
    // UI leaves blank — so every line priced to a zero deductible.
    expect(resolveDeductibleTier({ relationship: 0 as any, patientsCovered: null })).toBe('individual');
    expect(resolveDeductibleTier({ relationship: 0n as any, patientsCovered: null })).toBe('individual');
    expect(resolveDeductibleTier({ relationship: '0' as any, patientsCovered: null })).toBe('individual');
    expect(resolveDeductibleTier({ relationship: 1 as any, patientsCovered: null })).toBe('family');
  });

  it('falls back to the individual amount when family is left blank', () => {
    const grid = [{ type: 'Standard', individual: 500, family: '', metAmount: 0 }];
    const ledger = new DeductibleLedger(grid, 'family');
    expect(ledger.remaining('standard')).toBe(500);
  });

  it('honours an explicit family deductible', () => {
    const grid = [{ type: 'Standard', individual: 500, family: 1000, metAmount: 0 }];
    const ledger = new DeductibleLedger(grid, 'family');
    expect(ledger.remaining('standard')).toBe(1000);
  });

  it('treats a persisted family 0 as an unfilled cell when individual is set', () => {
    // The FE posts a blank Family input as 0, which persists as `"family": 0`
    // and is otherwise indistinguishable from a deliberate "no family
    // deductible". With individual populated, a 0 family must fall back to
    // individual instead of zeroing the pool out for family-tiered plans.
    const grid = [
      { type: 'Standard', individual: 100, family: 0, metAmount: 0 },
      { type: 'Basic', individual: 300, family: 0, metAmount: 0 },
      { type: 'Major', individual: 500, family: 0, metAmount: 0 },
    ];
    const ledger = new DeductibleLedger(grid, 'family');
    expect(ledger.remaining('standard')).toBe(100);
    expect(ledger.remaining('basic')).toBe(300);
    expect(ledger.remaining('major')).toBe(500);
  });

  it('keeps a zero deductible when both tiers are zero', () => {
    const grid = [{ type: 'Standard', individual: 0, family: 0, metAmount: 0 }];
    expect(new DeductibleLedger(grid, 'family').remaining('standard')).toBe(0);
  });
});

describe('regression: blank Family cells on a self-only plan', () => {
  // Verbatim shape persisted for a real patient's plan (Relationship 0 = Self,
  // Family left blank in the UI). Every line previously priced to
  // `deductibleApplied: 0` while still reporting a correct `deductibleRowKey`,
  // because the tier was misread as family and family was 0.
  const persistedGrid = [
    { type: 'Standard', typeKey: 'standard', lifetime: false, standard: false, individual: 100, family: 0, metAmount: 0, metDate: null },
    { type: 'Preventative', typeKey: 'preventative', lifetime: false, standard: false, individual: 100, family: 0, metAmount: 0, metDate: null },
    { type: 'Basic', typeKey: 'basic', lifetime: false, standard: false, individual: 300, family: 0, metAmount: 0, metDate: null },
    { type: 'Major', typeKey: 'major', lifetime: false, standard: false, individual: 500, family: 0, metAmount: 0, metDate: null },
    { type: 'Orthodontics', typeKey: 'orthodontics', lifetime: false, standard: false, individual: 400, family: 0, metAmount: 0, metDate: null },
  ];

  const ledgerForSelfPlan = () =>
    new DeductibleLedger(
      normalizeDeductibleGrid(persistedGrid),
      resolveDeductibleTier({ relationship: 0 as any, patientsCovered: null }),
    );

  it('resolves a self plan to the individual tier', () => {
    expect(resolveDeductibleTier({ relationship: 0 as any, patientsCovered: null })).toBe('individual');
  });

  it('prices D7140 against the Major pool', () => {
    const priced = price(ledgerForSelfPlan(), 'D7140', 130, 80);
    expect(priced.rowKey).toBe('major');
    expect(priced.deductibleApplied).toBe(130);
  });

  it('absorbs every allowed fee once the tier is resolved', () => {
    const ledger = ledgerForSelfPlan();
    // The estimate prices the ALLOWED fee, not the billed charge, so D1110 uses
    // its $85 allowed fee (not the $120 charge) against the $100 Preventative pool.
    expect(price(ledger, 'D1110', 85, 100)).toMatchObject({ rowKey: 'preventative', deductibleApplied: 85 });
    expect(price(ledger, 'D0120', 45, 100)).toMatchObject({ rowKey: 'standard', deductibleApplied: 45 });
    expect(price(ledger, 'D2391', 136, 80)).toMatchObject({ rowKey: 'basic', deductibleApplied: 136 });
    expect(price(ledger, 'D7140', 130, 80)).toMatchObject({ rowKey: 'major', deductibleApplied: 130 });
    expect(price(ledger, 'D8080', 60, 50)).toMatchObject({ rowKey: 'orthodontics', deductibleApplied: 60 });
  });

  it('leaves nothing for insurance when the pool is smaller than the fee', () => {
    const priced = price(ledgerForSelfPlan(), 'D7140', 130, 80);
    expect(priced.insurancePortion).toBe(0);
    expect(priced.coinsurance).toBe(0);
    expect(priced.patientPortion).toBe(130);
  });
});

describe('money parsing and legacy rows', () => {
  it('parses currency-formatted strings', () => {
    const rows = normalizeDeductibleRows([
      { type: 'Standard', individual: '$1,250.50', metAmount: '$300.00' },
    ]);
    expect(rows[0].individual).toBe(1250.5);
    expect(rows[0].metAmount).toBe(300);
  });

  it('treats blank and missing amounts as zero', () => {
    const rows = normalizeDeductibleRows([{ type: 'Standard', individual: '', family: undefined }]);
    expect(rows[0].individual).toBe(0);
    expect(rows[0].metAmount).toBe(0);
  });

  it('derives typeKey for legacy rows that lack it', () => {
    const rows = normalizeDeductibleRows([{ type: 'D2140' }, { type: 'Standard' }]);
    expect(rows.map((r) => r.typeKey)).toEqual(['code:D2140', 'standard']);
  });

  it('derives the scalar deductibleAmount from the Standard row, not row[0]', () => {
    // Preventative is first in the array but is not the Standard row
    const grid = [row('Preventative', 0), row('Standard', 500, { metAmount: 200 })];
    expect(deriveDeductibleAmount(grid)).toBe(500);
  });

  it('does NOT subtract metAmount: the scalar is the plan total', () => {
    // $500 plan with $300 met must still report 500. Remaining balance is the
    // engine's per-procedure concern, not this summary field's.
    const grid = [row('Standard', 500, { metAmount: 300 })];
    expect(deriveDeductibleAmount(grid)).toBe(500);
  });

  it('leaves the scalar stable as metAmount accumulates across claims', () => {
    const before = [row('Standard', 500, { metAmount: 0 })];
    const after = [row('Standard', 500, { metAmount: 500 })];
    expect(deriveDeductibleAmount(before)).toBe(500);
    expect(deriveDeductibleAmount(after)).toBe(500);
  });

  it('uses the family limit when the tier is family and one was provided', () => {
    const grid = [row('Standard', 500, { family: 900 })];
    expect(deriveDeductibleAmount(grid, 'individual')).toBe(500);
    expect(deriveDeductibleAmount(grid, 'family')).toBe(900);
  });

  it('falls back to individual when the family tier has no family amount', () => {
    const grid = [{ type: 'Standard', individual: 500, family: '', metAmount: 0 }];
    expect(deriveDeductibleAmount(grid, 'family')).toBe(500);
  });

  it('returns 0 for the scalar when Standard is absent', () => {
    expect(deriveDeductibleAmount([row('Major', 1000)])).toBe(0);
  });
});

describe('normalizeDeductibleGrid (persistence shape)', () => {
  it('derives typeKey from type and drops client-supplied typeKey', () => {
    const [r] = normalizeDeductibleGrid([
      { type: 'Preventative', individual: 100, typeKey: 'garbage' },
    ]);
    expect(r.typeKey).toBe('preventative');
  });

  it('normalizes bare D-codes to code:D#### form', () => {
    const [r] = normalizeDeductibleGrid([{ type: 'D1110', individual: 50 }]);
    expect(r.typeKey).toBe('code:D1110');
  });

  it('coerces currency-formatted strings the UI sends', () => {
    const [r] = normalizeDeductibleGrid([
      { type: 'Major', individual: '$1,250.00', metAmount: '0' },
    ]);
    expect(r.individual).toBe(1250);
    expect(r.metAmount).toBe(0);
  });

  it('drops rows with no usable type instead of persisting unusable keys', () => {
    const rows = normalizeDeductibleGrid([
      { type: '', individual: 100 },
      { individual: 200 },
      { type: 'Major', individual: 300 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('Major');
  });

  it('preserves metAmount and metDate so re-saving does not reset progress', () => {
    const [r] = normalizeDeductibleGrid([
      { type: 'Standard', individual: 1000, metAmount: 400, metDate: '2026-01-15' },
    ]);
    expect(r.metAmount).toBe(400);
    expect(r.metDate).toBe('2026-01-15');
  });

  it('handles non-array input without throwing', () => {
    expect(normalizeDeductibleGrid(undefined)).toEqual([]);
    expect(normalizeDeductibleGrid(null)).toEqual([]);
    expect(normalizeDeductibleGrid('nonsense')).toEqual([]);
  });
});

describe('reservation lifecycle (draft -> readyForSubmission -> draft)', () => {
  // Mirrors claim.service.reconcileDeductibleReservation so the idempotency
  // contract is pinned without needing a live claim + patplan fixture.
  // `estimate` is what the claim would consume; `held` is whether it is applied.
  const shouldHold = (status: string) => status !== 'draft' && status !== 'error';
  const reconcile = (
    estimate: Record<string, number>,
    held: boolean,
    status: string,
  ) => {
    const hold = shouldHold(status);
    if (hold === held) return { delta: null, held };
    if (Object.keys(estimate).length === 0) return { delta: null, held };
    const delta: Record<string, number> = {};
    for (const [k, v] of Object.entries(estimate)) delta[k] = hold ? v : -v;
    return { delta, held: hold };
  };

  it('a fresh draft reserves nothing despite carrying an estimate', () => {
    // The bug this pins: an unreserved draft has a non-empty estimate, and must
    // not be treated as already holding (which would release it).
    const r = reconcile({ standard: 500 }, false, 'draft');
    expect(r.delta).toBeNull();
    expect(r.held).toBe(false);
  });

  it('becoming readyForSubmission reserves the estimate', () => {
    const r = reconcile({ standard: 500 }, false, 'readyForSubmission');
    expect(r.delta).toEqual({ standard: 500 });
    expect(r.held).toBe(true);
  });

  it('re-sending an already-held claim applies no further delta', () => {
    expect(reconcile({ standard: 500 }, true, 'readyForSubmission').delta).toBeNull();
  });

  it('paid/partial/submitted/denied transitions do not re-reserve', () => {
    for (const s of ['paid', 'partial', 'submitted', 'denied', 'received']) {
      expect(reconcile({ standard: 500 }, true, s).delta).toBeNull();
    }
  });

  it('reverting a held claim to draft releases the full reservation', () => {
    const r = reconcile({ standard: 500, major: 200 }, true, 'draft');
    expect(r.delta).toEqual({ standard: -500, major: -200 });
    expect(r.held).toBe(false);
  });

  it('release then re-reserve round-trips to a single positive delta', () => {
    const released = reconcile({ standard: 500 }, true, 'draft');
    const rereserved = reconcile({ standard: 500 }, released.held, 'readyForSubmission');
    expect(rereserved.delta).toEqual({ standard: 500 });
  });

  it('error status releases the reservation like draft', () => {
    expect(reconcile({ standard: 500 }, true, 'error').delta).toEqual({ standard: -500 });
  });

  it('signs each row independently for mixed pools', () => {
    const r = reconcile({ standard: 500, major: 200 }, true, 'draft');
    expect(Object.values(r.delta!).every((v) => v < 0)).toBe(true);
  });

  it('is a no-op when there is no deductible estimate at all', () => {
    expect(reconcile({}, false, 'readyForSubmission').delta).toBeNull();
    expect(reconcile({}, false, 'readyForSubmission').held).toBe(false);
  });
});
