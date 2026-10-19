/**
 * Coverage-book limits wired through the pricing LOOP.
 *
 * Phase 1 (`coverage-limits.service.ts`) proves the pure rules in isolation.
 * These tests prove the loop actually CONSULTS them — a limit that is computed
 * correctly but never read is indistinguishable from no limit at all.
 *
 * DB-free by construction: `../src/config/db` is mocked to a bag of spies and
 * the plan metadata (which reaches the service through `opendental-auth.util`,
 * not through the injected `db`) is mocked too. The plan is priced through the
 * public `calculateInsuranceEstimates` entry point with only the `db` it needs,
 * so the test exercises the real ordering: limits → percent/flat → deductible →
 * annual max → lifetime trim → tally push.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  patplan: { findFirst: vi.fn() },
  fee: { findMany: vi.fn() },
  procedurecode: { findMany: vi.fn() },
  patient: { findUnique: vi.fn() },
  procedurelog: { findMany: vi.fn() },
  claimproc: { findMany: vi.fn(), aggregate: vi.fn() },
  claim: { findMany: vi.fn() },
  covspan: { findMany: vi.fn() },
  covcat: { findMany: vi.fn() },
}));

// The plan's stored meta, keyed by PatPlanNum.toString(). Populated per test.
const metaByPlan = vi.hoisted(() => ({ current: {} as Record<string, any> }));
// Held by reference so its implementation can be (re)installed in beforeEach —
// `restoreMocks: true` wipes an implementation given at creation time.
const metaMock = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock('../src/config/db', () => ({ prisma: db, applyTenantContextToTransaction: (x: any) => x }));
vi.mock('../src/utils/opendental-auth.util', () => ({
  getPatientInsuranceMeta: metaMock.fn,
}));

import { InvoiceService } from '../src/services/invoice.service';

const PRIMARY_PLAN = {
  PatPlanNum: 11n,
  PatNum: 1n,
  InsSubNum: 101n,
  Relationship: 'Self',
  inssub: {
    DateEffective: new Date('2026-01-01T00:00:00Z'),
    insplan: { AllowedFeeSched: null, FeeSched: null },
  },
};

const PATIENT_DOB = new Date('1980-01-01T00:00:00Z');

const setupDb = () => {
  for (const model of Object.values(db)) {
    for (const fn of Object.values(model) as any[]) fn.mockReset();
  }

  // The primary lookup carries no `Ordinal`; the secondary lookup asks for
  // `Ordinal: 2` and must come back empty so only the primary is priced.
  db.patplan.findFirst.mockImplementation(
    async (args: any) => (args?.where?.Ordinal === 2 ? null : PRIMARY_PLAN),
  );
  db.fee.findMany.mockResolvedValue([]);
  db.procedurecode.findMany.mockResolvedValue([]);
  db.patient.findUnique.mockResolvedValue({ Birthdate: PATIENT_DOB });
  db.procedurelog.findMany.mockResolvedValue([]);
  db.claimproc.findMany.mockResolvedValue([]);
  db.claimproc.aggregate.mockResolvedValue({ _sum: { InsPayAmt: 0 } });
  db.claim.findMany.mockResolvedValue([]);
  db.covspan.findMany.mockResolvedValue([]);
  db.covcat.findMany.mockResolvedValue([]);

  metaMock.fn.mockReset();
  metaMock.fn.mockImplementation(
    async (patPlanNum: bigint) => metaByPlan.current[String(patPlanNum)] ?? {},
  );
};

const run = (items: any[], meta: Record<string, any>) => {
  metaByPlan.current = { '11': meta };
  const service = new InvoiceService();
  return service.calculateInsuranceEstimates(1n, items, { db: db as any });
};

beforeEach(() => {
  setupDb();
});

describe('coverage limits in the primary pricing loop', () => {
  it('blocks a not-covered code: zero insurance, patient owes charge less write-off', async () => {
    const [line] = await run(
      [{ code: 'D1110', description: 'Prophylaxis', charge: 150 }],
      { coverageBookData: [{ code: 'D1110', nc: true }] },
    );

    expect(line.insPortion).toBe(0);
    expect(line.coveragePct).toBe(0);
    expect(line.coverageBlockedReason).toBe('not-covered');
    expect(line.ptPortion).toBe(150);
  });

  it('blocks a line whose service date falls inside the waiting period', async () => {
    const [within] = await run(
      [{ code: 'D1110', charge: 120, date: '2026-03-01' }],
      {
        coverageCategoryTable: [{ category: 'Preventative', coverage: 100, waiting: 6 }],
      },
    );
    // 2026-01-01 + 6 months = 2026-07-01; March is strictly before it.
    expect(within.insPortion).toBe(0);
    expect(within.coverageBlockedReason).toBe('waiting-period');
  });

  it('prices normally once the waiting period has elapsed', async () => {
    const [after] = await run(
      [{ code: 'D1110', charge: 120, date: '2026-08-01' }],
      {
        coverageCategoryTable: [{ category: 'Preventative', coverage: 100, waiting: 6 }],
      },
    );
    expect(after.coverageBlockedReason).toBeUndefined();
    expect(after.insPortion).toBe(120);
  });

  it('blocks only when age exceeds the limit (limit itself is covered)', async () => {
    // DOB 1980-01-01. On 2026-06-01 the patient is 46.
    const atLimit = await run(
      [{ code: 'D1110', charge: 100, date: '2026-06-01' }],
      { coverageBookData: [{ code: 'D1110', age: '46' }] },
    );
    expect(atLimit[0].coverageBlockedReason).toBeUndefined();
    expect(atLimit[0].insPortion).toBe(100);

    const overLimit = await run(
      [{ code: 'D1110', charge: 100, date: '2026-06-01' }],
      { coverageBookData: [{ code: 'D1110', age: '45' }] },
    );
    expect(overLimit[0].coverageBlockedReason).toBe('age');
    expect(overLimit[0].insPortion).toBe(0);
  });

  it('applies a flat plan portion in place of the percentage', async () => {
    const [line] = await run(
      [{ code: 'D1110', charge: 200 }],
      {
        // 80% would be 160; the flat pins the benefit at 50.
        coverageCategoryTable: [{ category: 'Preventative', coverage: 80 }],
        coverageBookData: [{ code: 'D1110', flatPlanPortion: '50' }],
      },
    );
    expect(line.insPortion).toBe(50);
    expect(line.coveragePct).toBe(0);
    expect(line.ptPortion).toBe(150);
  });

  it('trims a line that would exceed the code lifetime cap', async () => {
    const [line] = await run(
      [{ code: 'D1110', charge: 200 }],
      {
        coverageCategoryTable: [{ category: 'Preventative', coverage: 100 }],
        coverageBookData: [{ code: 'D1110', lifetimeLimit: '150' }],
      },
    );
    expect(line.insPortion).toBe(150);
    expect(line.ptPortion).toBe(50);
  });

  it('counts an already-paid service toward the lifetime cap', async () => {
    // $120 already paid against a $150 cap leaves only $30 of room.
    db.claimproc.findMany.mockResolvedValue([{ InsPayAmt: 120, ProcNum: 900n }]);
    db.procedurelog.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.ProcNum) return [{ ProcNum: 900n, CodeNum: 55n }];
      return [];
    });
    db.procedurecode.findMany.mockResolvedValue([{ CodeNum: 55n, ProcCode: 'D1110', CoverageCategory: null }]);

    const [line] = await run(
      [{ code: 'D1110', charge: 200 }],
      {
        coverageCategoryTable: [{ category: 'Preventative', coverage: 100 }],
        coverageBookData: [{ code: 'D1110', lifetimeLimit: '150' }],
      },
    );
    expect(line.insPortion).toBe(30);
  });

  it('pushes usage only for lines that actually paid, so a blocked line never advances the window', async () => {
    // Allowed one D1110 per 12 months. The first line is blocked by frequency
    // (a prior service exists in the window), so it must NOT push a second date.
    // If the blocked line pushed, the second line would also block and the
    // double-count would hide the bug.
    db.procedurelog.findMany.mockResolvedValue([
      { ProcNum: 1n, CodeNum: 7n, ProcDate: new Date('2026-05-01T00:00:00Z'), StatementNum: null },
    ]);
    db.procedurecode.findMany.mockResolvedValue([{ CodeNum: 7n, ProcCode: 'D1110', CoverageCategory: null }]);

    const [first, second] = await run(
      [
        { code: 'D1110', charge: 100, date: '2026-06-01' },
        { code: 'D1110', charge: 100, date: '2026-06-02' },
      ],
      {
        coverageCategoryTable: [{ category: 'Preventative', coverage: 100 }],
        coverageBookData: [{ code: 'D1110', deliveryPattern: '1/12 M' }],
      },
    );

    expect(first.coverageBlockedReason).toBe('frequency');
    expect(second.coverageBlockedReason).toBe('frequency');
  });

  it('does not count the prior service once it falls outside the rolling window', async () => {
    // Prior service is more than 12 months before the new one, so the window is
    // open on the left and the new line prices normally.
    db.procedurelog.findMany.mockResolvedValue([
      { ProcNum: 1n, CodeNum: 7n, ProcDate: new Date('2024-11-01T00:00:00Z'), StatementNum: null },
    ]);
    db.procedurecode.findMany.mockResolvedValue([{ CodeNum: 7n, ProcCode: 'D1110', CoverageCategory: null }]);

    const [line] = await run(
      [{ code: 'D1110', charge: 100, date: '2026-06-01' }],
      {
        coverageCategoryTable: [{ category: 'Preventative', coverage: 100 }],
        coverageBookData: [{ code: 'D1110', deliveryPattern: '1/12 M' }],
      },
    );
    expect(line.coverageBlockedReason).toBeUndefined();
    expect(line.insPortion).toBe(100);
  });

  it('clears a stale blocked reason on re-estimate', async () => {
    // Simulates recalculateInvoice spreading the previous BillingNote back in:
    // the incoming item already carries a reason from a prior run, but the code
    // is no longer blocked, so the stale marker must not survive.
    const [line] = await run(
      [{ code: 'D1110', charge: 100, date: '2026-06-01', coverageBlockedReason: 'not-covered' }],
      { coverageCategoryTable: [{ category: 'Preventative', coverage: 100 }] },
    );
    expect(line.coverageBlockedReason).toBeUndefined();
    expect(line.insPortion).toBe(100);
  });
});

describe('teeth-limited coverage in the primary pricing loop', () => {
  const meta = {
    coverageCategoryTable: [{ category: 'Restorative', coverage: 100 }],
    coverageBookData: [{ code: 'D2391', teethLimit: '3, 14' }],
  };

  it('covers a line on a listed tooth', async () => {
    const [line] = await run(
      [{ code: 'D2391', charge: 100, site: '3' }],
      meta,
    );
    expect(line.coverageBlockedReason).toBeUndefined();
    expect(line.insPortion).toBe(100);
  });

  it('blocks a line on a tooth the plan does not cover', async () => {
    const [line] = await run(
      [{ code: 'D2391', charge: 100, site: '5' }],
      meta,
    );
    expect(line.coverageBlockedReason).toBe('teeth-limit');
    expect(line.insPortion).toBe(0);
    expect(line.ptPortion).toBe(100);
  });

  it('blocks a line whose tooth cannot be determined', async () => {
    const [line] = await run(
      [{ code: 'D2391', charge: 100 }],
      meta,
    );
    expect(line.coverageBlockedReason).toBe('teeth-limit');
    expect(line.insPortion).toBe(0);
  });

  it('leaves a code with no tooth limit covering every tooth', async () => {
    const [line] = await run(
      [{ code: 'D2391', charge: 100, site: '5' }],
      {
        coverageCategoryTable: [{ category: 'Restorative', coverage: 100 }],
        coverageBookData: [{ code: 'D2391' }],
      },
    );
    expect(line.coverageBlockedReason).toBeUndefined();
    expect(line.insPortion).toBe(100);
  });
});

describe('teeth-limited DOWNGRADE in the pricing loop', () => {
  // D2391 downgrades to D2140 only on teeth 1 and 2. The rule's teeth live on
  // the downgrade-target row (D2140), which is where the coverage book stores a
  // downgrade tooth selection.
  const meta = {
    coverageCategoryTable: [{ category: 'Restorative', coverage: 100 }],
    coverageBookData: [
      { code: 'D2391', hasDowngrade: true, downgrade: 'D2140', maxAllowed: '50' },
      { code: 'D2140', teethLimit: '1, 2' },
    ],
  };

  it('downgrades a line on a tooth the rule allows', async () => {
    const [line] = await run([{ code: 'D2391', charge: 100, site: '1 (MO)' }], meta);
    expect(line.downgraded).toBe(true);
    expect(line.effectiveCode).toBe('D2140');
    // Priced on the substitute's fee (50), not the billed charge (100).
    expect(line.insPortion).toBe(50);
  });

  it('does NOT downgrade a line on a tooth outside the rule', async () => {
    const [line] = await run([{ code: 'D2391', charge: 100, site: '5 (MO)' }], meta);
    expect(line.downgraded).toBe(false);
    expect(line.downgradeSkipped).toBe('tooth');
    expect(line.insPortion).toBe(100);
  });

  it('does NOT downgrade a line with no tooth', async () => {
    const [line] = await run([{ code: 'D2391', charge: 100 }], meta);
    expect(line.downgraded).toBe(false);
    expect(line.downgradeSkipped).toBe('tooth');
    expect(line.insPortion).toBe(100);
  });

  it('downgrades on every tooth when the rule has no teeth limit', async () => {
    const [line] = await run(
      [{ code: 'D2391', charge: 100, site: '5 (MO)' }],
      {
        coverageCategoryTable: [{ category: 'Restorative', coverage: 100 }],
        coverageBookData: [
          { code: 'D2391', hasDowngrade: true, downgrade: 'D2140', maxAllowed: '50' },
        ],
      },
    );
    expect(line.downgraded).toBe(true);
    expect(line.effectiveCode).toBe('D2140');
    expect(line.insPortion).toBe(50);
  });
});

describe('teeth-limited DOWNGRADE for the SECONDARY plan', () => {
  const SECONDARY_PLAN = {
    PatPlanNum: 22n,
    PatNum: 1n,
    InsSubNum: 202n,
    Relationship: 'Self',
    Ordinal: 2,
    inssub: {
      DateEffective: new Date('2026-01-01T00:00:00Z'),
      insplan: { AllowedFeeSched: null, FeeSched: null },
    },
  };

  const runSecondary = (items: any[], secondaryMeta: Record<string, any>) => {
    // Only the Ordinal-2 lookup returns a plan; the primary lookup gets the empty
    // plan so its own downgrades do not interfere with the assertion.
    db.patplan.findFirst.mockImplementation(async (args: any) =>
      args?.where?.Ordinal === 2 ? SECONDARY_PLAN : PRIMARY_PLAN,
    );
    metaByPlan.current = {
      '11': { coverageCategoryTable: [{ category: 'Restorative', coverage: 0 }] },
      '22': secondaryMeta,
    };
    return new InvoiceService().calculateInsuranceEstimates(1n, items, { db: db as any });
  };

  const secondaryBook = {
    coverageCategoryTable: [{ category: 'Restorative', coverage: 100 }],
    coverageBookData: [
      { code: 'D2391', hasDowngrade: true, downgrade: 'D2140', maxAllowed: '50' },
      { code: 'D2140', teethLimit: '1, 2' },
    ],
  };

  it('downgrades on a tooth the secondary rule allows', async () => {
    const [line] = await runSecondary([{ code: 'D2391', charge: 100, site: '1 (MO)' }], secondaryBook);
    expect(line.secondaryDowngraded).toBe(true);
    expect(line.secondaryEffectiveCode).toBe('D2140');
  });

  it('does NOT downgrade on a tooth outside the secondary rule', async () => {
    const [line] = await runSecondary([{ code: 'D2391', charge: 100, site: '5 (MO)' }], secondaryBook);
    expect(line.secondaryDowngraded).toBe(false);
    expect(line.secondaryDowngradeSkipped).toBe('tooth');
  });
});

describe('fixed-benefit (Copay/Fixed Plan) pricing', () => {
  it('prices off the flat plan portion and ignores a stored percentage', async () => {
    const [line] = await run(
      [{ code: 'D1110', charge: 200 }],
      {
        coverageType: 'flat',
        // A legacy percentage is present but must NOT be honored.
        coverageCategoryTable: [{ category: 'Preventative', coverage: 80 }],
        coverageBookData: [{ code: 'D1110', flatPlanPortion: '50' }],
      },
    );
    expect(line.insPortion).toBe(50);
    expect(line.coveragePct).toBe(0);
    expect(line.ptPortion).toBe(150);
  });

  it('pays $0 for a code with no flat plan portion instead of a CDT default', async () => {
    const [line] = await run(
      [{ code: 'D1110', charge: 200 }],
      {
        coverageType: 'flat',
        // 80% would have been 160 under a percentage plan.
        coverageCategoryTable: [{ category: 'Preventative', coverage: 80 }],
      },
    );
    expect(line.insPortion).toBe(0);
    expect(line.coveragePct).toBe(0);
    expect(line.ptPortion).toBe(200);
    // A missing flat is not a "block": no reason marker is set.
    expect(line.coverageBlockedReason).toBeUndefined();
  });

  it('still honors coverage-book limits on a fixed-benefit plan', async () => {
    const [blocked] = await run(
      [{ code: 'D1110', charge: 200 }],
      {
        coverageType: 'flat',
        coverageBookData: [{ code: 'D1110', nc: true, flatPlanPortion: '50' }],
      },
    );
    expect(blocked.insPortion).toBe(0);
    expect(blocked.coverageBlockedReason).toBe('not-covered');
  });

  it('leaves percentage plans untouched (gating)', async () => {
    const [line] = await run(
      [{ code: 'D1110', charge: 200 }],
      { coverageCategoryTable: [{ category: 'Preventative', coverage: 80 }] },
    );
    expect(line.insPortion).toBe(160);
    expect(line.coveragePct).toBe(80);
  });
});
