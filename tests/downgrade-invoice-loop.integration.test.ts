/**
 * Downgrade pricing INTEGRATION test — exercises the real
 * `invoiceService.estimateInvoiceItems` pricing loop against a live patplan.
 *
 * `downgrade-engine.test.ts` proves the pure lookup rules and the money split.
 * It cannot catch a second `applyDeductible` call inside the loop, a missed
 * `no-fee` guard, or a non-PPO plan having its write-off clobbered — all of which
 * live in the loop, not the helpers. This file drives the loop.
 *
 * Scenarios:
 *   1. downgrade applied      -> insPortion on the substitute fee, ptPortion on
 *                                the billed charge, audit fields set
 *   2. no fee for substitute  -> downgradeSkipped 'no-fee', never priced at $0
 *   3. tooth outside limit    -> downgradeSkipped 'tooth', normal pricing
 *   4. non-PPO plan           -> write-off untouched, only insPortion drops
 *   5. deductible once        -> a partially-met pool is drained exactly once
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { invoiceService } from '../src/services/invoice.service';
import { getPatientInsuranceMeta, setPatientInsuranceMeta } from '../src/utils/opendental-auth.util';
import { getNextId } from '../src/utils/opendental-ids.util';
import { normalizeDeductibleGrid } from '../src/services/deductible.service';

const CROWN_CHARGE = 1200;
const CROWN_CONTRACTED = 900;
const BUILDUP_FEE = 300;

let patNum: bigint;
let provNum: bigint;
let carrierNum: bigint;
let planNum: bigint;
let insSubNum: bigint;
let patPlanNum: bigint;
const cleanup: Array<() => Promise<unknown>> = [];

/** Build a plan row with a $2000 Basic deductible and the given coverage book. */
const configurePlan = async (coverageBookData: any[], metAmount = 0) => {
  const meta: any = await getPatientInsuranceMeta(patPlanNum);
  await setPatientInsuranceMeta(patPlanNum, {
    ...meta,
    deductiblesGrid: normalizeDeductibleGrid([
      {
        type: 'Basic',
        lifetime: false,
        standard: false,
        individual: 2000,
        family: 2000,
        metAmount,
        metDate: '',
      },
    ]),
    coverageBookData,
    // 50% coverage for all categories, so the percentages are predictable.
    coverageCategoryTable: [
      { category: 'Restorative', coverage: 50 },
      { category: 'Basic', coverage: 50 },
      { category: 'Major', coverage: 50 },
    ],
  } as any);
};

const estimate = (overrides: Record<string, any> = {}) =>
  invoiceService.estimateInvoiceItems(patNum.toString(), [
    {
      code: 'D2740',
      description: 'Crown - porcelain/ceramic',
      charge: CROWN_CHARGE,
      ...overrides,
    },
  ] as any);

/** PPO allowed-fee schedule: D2740 contracted, D2791 cheaper. */
const seedPpoFeeSchedule = async () => {
  const feeSchedNum = await getNextId('feesched', 'FeeSchedNum');
  await prisma.feesched.create({
    data: { FeeSchedNum: feeSchedNum, Description: `DG FeeSched ${patNum}` },
  });
  cleanup.push(() => prisma.feesched.delete({ where: { FeeSchedNum: feeSchedNum } }));

  // Reuse the existing procedure codes where present — D2740/D2791 are seeded
  // in most databases, and `ProcCode` is the primary key so it cannot be
  // re-inserted. Only codes that are genuinely absent get created.
  for (const [code, amount] of [
    ['D2740', CROWN_CONTRACTED],
    ['D2791', BUILDUP_FEE],
  ] as const) {
    let proc = await prisma.procedurecode.findUnique({ where: { ProcCode: code } });
    if (!proc) {
      const codeNum = await getNextId('procedurecode', 'CodeNum');
      proc = await prisma.procedurecode.create({ data: { CodeNum: codeNum, ProcCode: code } });
      cleanup.push(() => prisma.procedurecode.delete({ where: { ProcCode: code } }));
    }
    const feeNum = await getNextId('fee', 'FeeNum');
    await prisma.fee.create({
      data: { FeeNum: feeNum, FeeSched: feeSchedNum, CodeNum: proc.CodeNum!, Amount: amount },
    });
    // Registered AFTER the schedule so reversed teardown removes the fee row
    // first — deleting the schedule first trips the FK and leaks both.
    cleanup.push(() => prisma.fee.delete({ where: { FeeNum: feeNum } }));
  }

  await prisma.insplan.update({
    where: { PlanNum: planNum },
    data: { PlanType: 'p', FeeSched: feeSchedNum, AllowedFeeSched: feeSchedNum },
  });
  return feeSchedNum;
};

/**
 * Non-PPO: no contracted fee for the BILLED code, so its write-off is manual.
 * The schedule still carries the SUBSTITUTE's fee, otherwise the downgrade
 * would (correctly) skip as 'no-fee' and the test would prove nothing.
 */
const seedSubstituteOnlyFeeSchedule = async () => {
  const feeSchedNum = await getNextId('feesched', 'FeeSchedNum');
  await prisma.feesched.create({
    data: { FeeSchedNum: feeSchedNum, Description: `DG SubOnly ${patNum}` },
  });
  cleanup.push(() => prisma.feesched.delete({ where: { FeeSchedNum: feeSchedNum } }));

  const proc = await prisma.procedurecode.findUnique({ where: { ProcCode: 'D2791' } });
  const feeNum = await getNextId('fee', 'FeeNum');
  await prisma.fee.create({
    data: { FeeNum: feeNum, FeeSched: feeSchedNum, CodeNum: proc!.CodeNum!, Amount: BUILDUP_FEE },
  });
  cleanup.push(() => prisma.fee.delete({ where: { FeeNum: feeNum } }));

  // PlanType '' with no AllowedFeeSched: the BILLED code has no contracted fee.
  await prisma.insplan.update({
    where: { PlanNum: planNum },
    data: { PlanType: '', FeeSched: feeSchedNum, AllowedFeeSched: null },
  });
};

describe('Downgrade pricing through the invoice loop', () => {
  beforeAll(async () => {
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: { PatNum: patNum, FName: 'Dg', LName: `Downgrade${patNum}`, Birthdate: new Date('1990-01-15') },
    });
    cleanup.push(() => prisma.patient.delete({ where: { PatNum: patNum } }));

    provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: provNum,
        Abbr: `DG${String(patNum).slice(-5)}`,
        LName: 'DowngradeDentist',
        FName: 'Dana',
        NationalProvID: '9876543210',
      },
    });
    cleanup.push(() => prisma.provider.delete({ where: { ProvNum: provNum } }));

    carrierNum = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Downgrade Carrier ${patNum}`,
        ElectID: `DG${String(patNum).slice(-6)}${Math.floor(Math.random() * 1000)}`,
      },
    });
    cleanup.push(() => prisma.carrier.delete({ where: { CarrierNum: carrierNum } }));

    planNum = await getNextId('insplan', 'PlanNum');
    await prisma.insplan.create({ data: { PlanNum: planNum, CarrierNum: carrierNum, PlanType: '' } });
    cleanup.push(() => prisma.insplan.delete({ where: { PlanNum: planNum } }));

    insSubNum = await getNextId('inssub', 'InsSubNum');
    await prisma.inssub.create({
      data: { InsSubNum: insSubNum, PlanNum: planNum, Subscriber: patNum, SubscriberID: `SUB${patNum}` },
    });

    patPlanNum = await getNextId('patplan', 'PatPlanNum');
    await prisma.patplan.create({
      data: { PatPlanNum: patPlanNum, PatNum: patNum, InsSubNum: insSubNum, Ordinal: 1, IsPending: 0 },
    });
    // `cleanup` is reversed at teardown, so push in dependency order:
    // patplan is deleted before inssub, which is deleted before insplan.
    cleanup.push(() => prisma.inssub.delete({ where: { InsSubNum: insSubNum } }));
    cleanup.push(() => prisma.patplan.delete({ where: { PatPlanNum: patPlanNum } }));

    await seedPpoFeeSchedule();
  });

  afterAll(async () => {
    // Detach the plan from its fee schedules first. Several tests repoint
    // insplan.FeeSched at a new schedule, so an earlier schedule can still be
    // referenced at teardown and its delete would trip the FK.
    await prisma.insplan
      .update({
        where: { PlanNum: planNum },
        data: { FeeSched: null, AllowedFeeSched: null },
      })
      .catch(() => undefined);

    // Failures are collected rather than swallowed: a silent `.catch()` here
    // leaks rows into the dev database on every run, which is how a dozen
    // orphan patients and fee schedules accumulated in the first place.
    const failures: string[] = [];
    for (const fn of cleanup.reverse()) {
      try {
        await fn();
      } catch (err: any) {
        failures.push(err?.message ?? String(err));
      }
    }
    if (failures.length > 0) {
      throw new Error(`Teardown leaked rows (${failures.length}):\n${failures.join('\n')}`);
    }
  });

  it('prices insurance on the substitute fee but bills the patient for the real one', async () => {
    await configurePlan([{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }], 1900);

    const [item] = await estimate({ site: '30' });

    // $100 of Basic deductible remains, so it clears before coinsurance.
    // Insurance basis is the $300 substitute: (300 - 100) * 50% = $100.
    expect(item.downgraded).toBe(true);
    expect(item.downgradedFrom).toBe('D2740');
    expect(item.effectiveCode).toBe('D2791');
    expect(item.deductibleApplied).toBe(100);
    expect(item.insPortion).toBe(100);

    // Write-off comes from the BILLED code's contracted fee ($1200 -> $900).
    expect(item.writeoff).toBe(300);
    // Patient owes the REAL procedure: 1200 - 300 write-off - 100 ins = 800.
    // Without the correction this would be 200 (derived from the $300 basis).
    expect(item.ptPortion).toBe(800);
    // `balance` is the GROSS charge, not the patient share — the line is billed
    // for the real procedure regardless of how the downgrade split funds it.
    expect(item.balance).toBe(1200);
  });

  it('charges the deductible exactly once, not twice', async () => {
    await configurePlan([{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }], 1900);

    const [item] = await estimate({ site: '30' });

    // The whole remaining pool ($100) is consumed by this single line.
    expect(item.deductibleApplied).toBe(100);
    const meta: any = await getPatientInsuranceMeta(patPlanNum);
    const basic = (meta.deductiblesGrid ?? []).find((r: any) => r.typeKey === 'basic');
    expect(Number(basic.metAmount) || 0).toBe(1900);
  });

  it('skips the downgrade when the substitute has no fee, never pricing at $0', async () => {
    // D2391 -> D9998. D9998 is deliberately not a real CDT code, so no fee
    // schedule can ever carry an allowance for it — the "no fee" branch is
    // guaranteed regardless of what the database happens to contain.
    await configurePlan([{ code: 'D2391', hasDowngrade: true, downgrade: 'D9998' }], 1900);

    const [item] = await estimate({ code: 'D2391', site: '3' });

    expect(item.downgradeSkipped).toBe('no-fee');
    expect(item.downgraded).toBeFalsy();
    expect(item.effectiveCode).toBeUndefined();
    // Priced on its own allowance, NOT zeroed by the missing substitute.
    expect(item.insPortion).toBeGreaterThan(0);
    expect(item.ptPortion).toBeGreaterThan(0);
  });

  it('falls back to the row maxAllowed when the plan has no fee for the substitute', async () => {
    await configurePlan(
      [{ code: 'D2391', hasDowngrade: true, downgrade: 'D9998', maxAllowed: '250' }],
      1900
    );

    const [item] = await estimate({ code: 'D2391', site: '3' });

    expect(item.downgraded).toBe(true);
    expect(item.effectiveCode).toBe('D9998');
    // Basis is the $250 maxAllowed fallback: (250 - 100) * 50% = 75.
    expect(item.insPortion).toBe(75);
  });

  it('records downgradeSkipped "tooth" when the limit excludes the tooth', async () => {
    await configurePlan(
      [
        { code: 'D2740', hasDowngrade: true, downgrade: 'D2791' },
        { code: 'D2791', teethLimit: '1, 2, 3' },
      ],
      1900
    );

    const [excluded] = await estimate({ site: '30' });
    expect(excluded.downgradeSkipped).toBe('tooth');
    expect(excluded.downgraded).toBeFalsy();

    const [included] = await estimate({ site: '3' });
    expect(included.downgraded).toBe(true);
    expect(included.effectiveCode).toBe('D2791');
  });

  it('declines a tooth range that straddles the limit', async () => {
    await configurePlan(
      [
        { code: 'D2740', hasDowngrade: true, downgrade: 'D2791' },
        { code: 'D2791', teethLimit: '1, 2, 3' },
      ],
      1900
    );

    // "1-3" is fully inside the limit.
    const [inside] = await estimate({ site: '1-3' });
    expect(inside.downgraded).toBe(true);

    // "2-4" straddles it — ambiguous, so no downgrade.
    const [straddle] = await estimate({ site: '2-4' });
    expect(straddle.downgradeSkipped).toBe('tooth');
    expect(straddle.downgraded).toBeFalsy();
  });

  it('leaves the write-off untouched on a non-PPO plan', async () => {
    // No contracted fee for D2740, so its write-off stays whatever the user set.
    await seedSubstituteOnlyFeeSchedule();
    await configurePlan([{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }], 1900);

    const [item] = await estimate({ site: '30', writeoff: 250 });

    expect(item.downgraded).toBe(true);
    // The manual write-off must survive: the downgrade must not recompute it.
    expect(item.writeoff).toBe(250);
    // Insurance still drops to the substitute basis.
    expect(item.insPortion).toBe(100);
    expect(item.ptPortion).toBe(CROWN_CHARGE - 250 - 100);

    // Restore the full PPO schedule for any later test in this file.
    await seedPpoFeeSchedule();
  });

  it('re-applies on re-estimate (recalculateInvoice), not just at creation', async () => {
    // The FE "Re-estimate" actions (EditInvoiceDetailsDialog / EditEstimatesDialog)
    // both POST /invoices/:id/recalculate, which re-runs this same pricing loop
    // over the persisted BillingNote. A downgrade configured AFTER an invoice was
    // created must therefore be picked up on the next re-estimate.
    await configurePlan([], 1900); // no rule yet
    const created: any = await invoiceService.createStandaloneInvoice(
      {
        patientId: patNum.toString(),
        items: [
          {
            code: 'D2740',
            description: 'Crown - porcelain/ceramic',
            charge: CROWN_CHARGE,
            site: '30',
            date: new Date().toISOString(),
          },
        ],
      } as any,
      'downgrade-test'
    );
    // The mapped invoice exposes the statement number as `id`.
    const invoiceId = String(created.id);
    const StatementNum = BigInt(invoiceId);
    cleanup.push(() =>
      prisma.procedurelog.deleteMany({ where: { StatementNum } }).then(() =>
        prisma.statement.delete({ where: { StatementNum } })
      )
    );
    // Creating an invoice runs agingService, which writes a `famaging` row.
    // That model is `@@ignore`d in the Prisma schema, so it is absent from the
    // generated client and must be removed with raw SQL — otherwise it blocks
    // the patient delete at teardown and leaks a row per run.
    cleanup.push(async () => {
      await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1::bigint', patNum.toString());
    });

    const readLine = async () => {
      const procs = await prisma.procedurelog.findMany({ where: { StatementNum } });
      return JSON.parse(procs[0].BillingNote || '{}');
    };

    // Before the rule exists: normal contractual pricing.
    let line = await readLine();
    expect(line.downgraded).toBeFalsy();

    // Now turn the downgrade on and re-estimate.
    await configurePlan([{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }], 1900);
    await invoiceService.recalculateInvoice(invoiceId);

    line = await readLine();
    // Insurance drops to the substitute basis, and the audit fields persist.
    expect(line.downgraded).toBe(true);
    expect(line.downgradedFrom).toBe('D2740');
    expect(line.effectiveCode).toBe('D2791');
    expect(line.insPortion).toBe(100); // (300 substitute - 100 deductible) * 50%
    // The patient still owes the real procedure.
    expect(line.ptPortion).toBe(800); // 1200 - 300 write-off - 100 insurance
    expect(line.writeoff).toBe(300);

    // Removing the rule and re-estimating again must CLEAR the stale audit
    // fields, not leave the previous downgrade baked into the invoice.
    await configurePlan([], 1900);
    await invoiceService.recalculateInvoice(invoiceId);

    line = await readLine();
    expect(line.downgraded).toBe(false);
    expect(line.downgradedFrom).toBeNull();
    expect(line.effectiveCode).toBeNull();
    expect(line.insPortion).toBe(400); // back to full $900 allowed fee
    expect(line.ptPortion).toBe(500);
  });

  it('prices a line with no rule exactly as it did before', async () => {
    await configurePlan([{ code: 'D2391', hasDowngrade: true, downgrade: 'D2140' }], 1900);

    const [item] = await estimate({ site: '30' });

    expect(item.downgraded).toBe(false);
    // Explicitly null rather than absent, so a stale value from a previous
    // pricing run can never be inherited on re-estimate.
    expect(item.downgradeSkipped).toBeNull();
    // Baseline behaviour, unchanged by the downgrade feature: the CONTRACTUAL
    // write-off comes from the billed code's own $900 allowed fee, the $100
    // remaining Basic deductible clears first, then 50% coinsurance.
    expect(item.writeoff).toBe(300);
    expect(item.deductibleApplied).toBe(100);
    expect(item.insPortion).toBe(400); // (900 - 100) * 50%
    expect(item.ptPortion).toBe(500); // 100 deductible + 400 coinsurance
  });
});
