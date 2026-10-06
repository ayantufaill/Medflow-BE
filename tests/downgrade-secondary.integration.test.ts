/**
 * Downgrade + secondary insurance INTEGRATION test — drives the real
 * `invoiceService.estimateInvoiceItems` pricing loop for a patient holding two
 * patplans (Ordinal 1 primary, Ordinal 2 secondary).
 *
 * `downgrade-invoice-loop.integration.test.ts` covers the primary-only path.
 * It cannot catch the secondary block, which is a separate loop further down
 * and is where a downgrade interacts with a second payer.
 *
 * The secondary is priced INDEPENDENTLY: its own fee schedule, its own coverage
 * percentages, its own deductible pool and its own alternate-benefit rules. It
 * does not inherit the primary's basis, and it is not a transfer of the
 * primary's coinsurance. What it does inherit is the COORDINATION cap — its
 * payment can never exceed what the primary left on the line.
 *
 * Scenarios:
 *   1. secondary priced on its own terms whether or not the primary downgraded
 *   2. the two plans' downgrade rules are resolved independently
 *   3. the secondary drains its OWN deductible, not the primary's
 *   4. the secondary is capped at the balance remaining after the primary
 *   5. `secondaryNotEstimated` means only "secondary unpriceable" — a
 *      downgraded or skipped PRIMARY no longer sets it
 *   6. the coinsurance split survives as the fallback for a secondary with no
 *      `insplan`
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
const COVERAGE_PCT = 50;
/** $2000 Basic deductible with $1900 met, so $100 clears before coinsurance. */
const DEDUCTIBLE_MET = 1900;

let patNum: bigint;
let carrierNum: bigint;
let carrier2Num: bigint;
let planNum: bigint;
let plan2Num: bigint;
let insSubNum: bigint;
let insSub2Num: bigint;
let patPlanNum: bigint;
let patPlan2Num: bigint;
const cleanup: Array<() => Promise<unknown>> = [];

/**
 * Attach coverage book + deductible grid to a patplan's meta JSON.
 *
 * Coverage books live in the patplan meta (FkeyType 207), NOT in a table — a
 * plan-level coveragebook row does not exist, so anything that creates one is
 * written against a schema that was never there.
 */
const configurePlan = async (
  targetPatPlanNum: bigint,
  coverageBookData: any[],
  opts: { metAmount?: number; coveragePct?: number; deductible?: number } = {},
) => {
  const metAmount = opts.metAmount ?? DEDUCTIBLE_MET;
  const coveragePct = opts.coveragePct ?? COVERAGE_PCT;
  const deductible = opts.deductible ?? 2000;
  const meta: any = await getPatientInsuranceMeta(targetPatPlanNum);
  await setPatientInsuranceMeta(targetPatPlanNum, {
    ...meta,
    deductiblesGrid: normalizeDeductibleGrid([
      {
        type: 'Basic',
        lifetime: false,
        standard: false,
        individual: deductible,
        family: deductible,
        metAmount,
        metDate: '',
      },
    ]),
    coverageBookData,
    coverageCategoryTable: [
      { category: 'Restorative', coverage: coveragePct },
      { category: 'Basic', coverage: coveragePct },
      { category: 'Major', coverage: coveragePct },
    ],
  } as any);
};

const estimate = (overrides: Record<string, any> = {}) =>
  invoiceService.estimateInvoiceItems(patNum.toString(), [
    {
      code: 'D2740',
      description: 'Crown - porcelain/ceramic',
      charge: CROWN_CHARGE,
      site: '30',
      ...overrides,
    },
  ] as any);

/**
 * Build a PPO allowed-fee schedule for the given plan.
 *
 * `downgrades` lists which codes the schedule must price — the caller passes
 * only what that plan needs, because a plan with no allowance for the
 * substitute makes the loop skip the downgrade as 'no-fee' and the test would
 * prove nothing.
 */
const seedPlanFeeSchedule = async (targetPlanNum: bigint, amounts: Array<[string, number]>) => {
  const feeSchedNum = await getNextId('feesched', 'FeeSchedNum');
  await prisma.feesched.create({
    data: { FeeSchedNum: feeSchedNum, Description: `DG Sec ${feeSchedNum}` },
  });
  cleanup.push(() => prisma.feesched.delete({ where: { FeeSchedNum: feeSchedNum } }));

  for (const [code, amount] of amounts) {
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
    cleanup.push(() => prisma.fee.delete({ where: { FeeNum: feeNum } }));
  }

  await prisma.insplan.update({
    where: { PlanNum: targetPlanNum },
    data: { PlanType: 'p', FeeSched: feeSchedNum, AllowedFeeSched: feeSchedNum },
  });
  return feeSchedNum;
};

/**
 * Run `fn` with a plan's fee schedule temporarily replaced, then restore it.
 *
 * `seedPlanFeeSchedule` repoints `insplan.FeeSched`/`AllowedFeeSched` at a new
 * schedule and never puts the old one back, so a test that swaps in a generous
 * allowance silently changes every later test in the file. Each test owns the
 * prices it depends on and nothing else.
 */
const withPlanFeeSchedule = async (
  targetPlanNum: bigint,
  amounts: Array<[string, number]>,
  fn: () => Promise<void>,
) => {
  const before = await prisma.insplan.findUnique({
    where: { PlanNum: targetPlanNum },
    select: { FeeSched: true, AllowedFeeSched: true, PlanType: true },
  });
  try {
    await seedPlanFeeSchedule(targetPlanNum, amounts);
    await fn();
  } finally {
    await prisma.insplan.update({
      where: { PlanNum: targetPlanNum },
      data: {
        FeeSched: before?.FeeSched ?? null,
        AllowedFeeSched: before?.AllowedFeeSched ?? null,
        PlanType: before?.PlanType ?? '',
      },
    });
  }
};

describe('Downgrade with secondary insurance', () => {
  beforeAll(async () => {
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: { PatNum: patNum, FName: 'Dg', LName: `SecDowngrade${patNum}`, Birthdate: new Date('1990-01-15') },
    });
    cleanup.push(() => prisma.patient.delete({ where: { PatNum: patNum } }));

    for (const [which, carrierKey] of [[1, 'carrierNum'], [2, 'carrier2Num']] as const) {
      const carrier = await getNextId('carrier', 'CarrierNum');
      await prisma.carrier.create({
        data: {
          CarrierNum: carrier,
          CarrierName: `DG Sec ${which} ${patNum}`,
          ElectID: `DG${String(patNum).slice(-6)}${which}${Math.floor(Math.random() * 100)}`,
        },
      });
      if (which === 1) carrierNum = carrier;
      else carrier2Num = carrier;
      cleanup.push(() => prisma.carrier.delete({ where: { CarrierNum: carrier } }));

      const plan = await getNextId('insplan', 'PlanNum');
      await prisma.insplan.create({ data: { PlanNum: plan, CarrierNum: carrier, PlanType: '' } });
      if (which === 1) planNum = plan;
      else plan2Num = plan;
      cleanup.push(() => prisma.insplan.delete({ where: { PlanNum: plan } }));

      const insSub = await getNextId('inssub', 'InsSubNum');
      await prisma.inssub.create({
        data: { InsSubNum: insSub, PlanNum: plan, Subscriber: patNum, SubscriberID: `SUB${which}${patNum}` },
      });
      if (which === 1) insSubNum = insSub;
      else insSub2Num = insSub;

      const patPlan = await getNextId('patplan', 'PatPlanNum');
      await prisma.patplan.create({
        data: {
          PatPlanNum: patPlan,
          PatNum: patNum,
          InsSubNum: insSub,
          Ordinal: which,
          IsPending: 0,
        },
      });
      if (which === 1) patPlanNum = patPlan;
      else patPlan2Num = patPlan;
      // `cleanup` is reversed at teardown, so push in dependency order.
      cleanup.push(() => prisma.inssub.delete({ where: { InsSubNum: insSub } }));
      cleanup.push(() => prisma.patplan.delete({ where: { PatPlanNum: patPlan } }));
    }

    // PRIMARY: contracts D2740 at $900 and prices the D2791 substitute at $300.
    await seedPlanFeeSchedule(planNum, [
      ['D2740', CROWN_CONTRACTED],
      ['D2791', BUILDUP_FEE],
    ]);

    // SECONDARY: its own fee schedule, and deliberately NO downgrade rule — the
    // case the withdrawn fix got wrong. Under proper COB this plan would allow
    // $180 and pay 80% of it; the loop cannot price that today because it only
    // ever loads the PRIMARY patplan's meta and fees.
    await seedPlanFeeSchedule(plan2Num, [['D2740', 180]]);
  });

  afterAll(async () => {
    // Detach both plans from their fee schedules first — several helpers
    // repoint insplan.FeeSched, so an earlier schedule can still be referenced
    // at teardown and its delete would trip the FK.
    for (const plan of [planNum, plan2Num]) {
      await prisma.insplan
        .update({ where: { PlanNum: plan }, data: { FeeSched: null, AllowedFeeSched: null } })
        .catch(() => undefined);
    }

    // Failures are collected rather than swallowed: a silent `.catch()` here
    // leaks rows into the dev database on every run.
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

  it('persists the secondary estimate and its audit trail on re-estimate', async () => {
    // The FE "Re-estimate" actions POST /invoices/:id/recalculate, which
    // re-prices from the persisted BillingNote. Two things must survive that
    // round trip: the independently-priced secondary payment, and the audit
    // fields describing WHY it was priced that way.
    //
    // The teeth-limit case is chosen deliberately — it moves the audit fields
    // without moving any money, which is exactly the shape a change-guard built
    // only around the portions would silently drop.
    await configurePlan(patPlanNum, []);
    await configurePlan(patPlan2Num, [
      { code: 'D2740', hasDowngrade: true, downgrade: 'D2790' },
      { code: 'D2790', teethLimit: '1, 2, 3' },
    ]);
    await withPlanFeeSchedule(
      plan2Num,
      [
        ['D2740', 180],
        ['D2790', 120],
        ['D2791', 180],
      ],
      async () => {
        const created: any = await invoiceService.createStandaloneInvoice(
          {
            patientId: patNum.toString(),
            items: [
              {
                code: 'D2740',
                description: 'Crown - porcelain/ceramic',
                charge: CROWN_CHARGE,
                // Tooth 30 sits outside the 1-3 limit, so the secondary rule does
                // not apply and the line prices on its own $180 allowance.
                site: '30',
                date: new Date().toISOString(),
              },
            ],
          } as any,
          'secondary-reestimate'
        );
        const StatementNum = BigInt(String(created.id));
        cleanup.push(() =>
          prisma.procedurelog.deleteMany({ where: { StatementNum } }).then(() =>
            prisma.statement.delete({ where: { StatementNum } })
          )
        );
        // `createStandaloneInvoice` refreshes the patient's family-aging snapshot,
        // and that row FKs to `patient`, so it has to be cleared before the
        // patient delete in `cleanup` can run.
        cleanup.push(() =>
          prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1::bigint', patNum.toString())
        );

        const readLine = async () => {
          const procs = await prisma.procedurelog.findMany({ where: { StatementNum } });
          return JSON.parse(procs[0].BillingNote || '{}');
        };

        // At creation: primary pays 400 on its own $900 allowance, and the
        // secondary pays 40 on its own $180 with the rule excluded by teeth.
        let line = await readLine();
        expect(line.primaryInsPortion).toBe(400);
        expect(line.secondaryInsPortion).toBe(40);
        expect(line.secondaryDowngraded).toBe(false);
        expect(line.secondaryDowngradeSkipped).toBe('tooth');

        // Re-price with a secondary rule that DOES apply to tooth 30 and whose
        // substitute the plan allows at exactly the same $180 the billed code
        // already gets. The payment therefore does not move — $40 before, $40
        // after — while every audit field changes. A change-guard built only
        // around the portions would decide there is nothing to save here and
        // drop the new decision on the floor.
        await configurePlan(patPlan2Num, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }]);
        await invoiceService.recalculateInvoice(String(created.id));

        line = await readLine();
        expect(line.secondaryDowngraded).toBe(true);
        expect(line.secondaryDowngradedFrom).toBe('D2740');
        expect(line.secondaryEffectiveCode).toBe('D2791');
        expect(line.secondaryDowngradeSkipped).toBeNull();
        expect(line.secondaryInsPortion).toBe(40);
        expect(line.secondaryCoveragePct).toBe(COVERAGE_PCT);
        expect(line.totalInsPortion).toBe(440);

        // Now drop the rule entirely and re-estimate. Every secondary audit field
        // must clear rather than keep describing the removed rule.
        await configurePlan(patPlan2Num, []);
        await invoiceService.recalculateInvoice(String(created.id));

        line = await readLine();
        expect(line.secondaryDowngraded).toBe(false);
        expect(line.secondaryDowngradedFrom).toBeNull();
        expect(line.secondaryEffectiveCode).toBeNull();
        expect(line.secondaryDowngradeSkipped).toBeNull();
        expect(line.secondaryNotEstimated).toBe(false);
        // Back to the plan's own allowance: (180 - 100) * 50% = 40.
        expect(line.secondaryInsPortion).toBe(40);
      }
    );
  });

  it('prices the secondary independently when the PRIMARY is downgraded', async () => {
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }]);
    // The secondary has NO downgrade rule of its own. It must price the line
    // against its own $180 allowance — not inherit the primary's $300
    // downgraded basis, and not be left at the $0 stopgap.
    await configurePlan(patPlan2Num, []);

    const [item] = await estimate();

    // Primary priced on the $300 substitute: (300 - 100 deductible) * 50%.
    expect(item.downgraded).toBe(true);
    expect(item.effectiveCode).toBe('D2791');
    expect(item.primaryInsPortion).toBe(100);

    // Secondary priced on its OWN basis: no rule, so its own $180 allowed fee
    // for the BILLED code, then its own deductible, then its own percentage.
    expect(item.secondaryDowngraded).toBeFalsy();
    expect(item.secondaryEffectiveCode).toBeNull();
    expect(item.secondaryCoveragePct).toBe(COVERAGE_PCT);
    // Its own $2000 deductible is also $1900 met, so $100 clears first:
    // (180 - 100) * 50% = 40.
    expect(item.secondaryInsPortion).toBe(40);

    // A downgraded primary no longer means "unestimated" — the secondary was
    // priced on its own terms.
    expect(item.secondaryNotEstimated).toBeFalsy();

    // Patient sees the residual: 1200 - 300 write-off - 100 primary - 40 secondary.
    expect(item.ptPortion).toBe(760);
    expect(item.balance).toBe(CROWN_CHARGE);
  });

  it('prices the secondary independently on a line with no downgrade anywhere', async () => {
    // Guards the intended behavior change: the secondary now pays what its own
    // plan allows, not a transfer of the primary's coinsurance.
    await configurePlan(patPlanNum, []);
    await configurePlan(patPlan2Num, []);

    const [item] = await estimate();

    expect(item.downgraded).toBeFalsy();
    expect(item.secondaryNotEstimated).toBeFalsy();
    expect(item.deductibleApplied).toBe(100);

    // Primary: (900 - 100) * 50% = 400.
    expect(item.primaryInsPortion).toBe(400);
    // Secondary on its own basis: (180 - 100) * 50% = 40.
    //
    // This is NOT the old coinsurance transfer, which produced $400 here. The
    // secondary pays its own plan's actual benefit, which is far less than the
    // primary's contractual fee — the behavior change settled on up front.
    expect(item.secondaryInsPortion).toBe(40);
    expect(item.ptPortion).toBe(460);
    expect(item.balance).toBe(CROWN_CHARGE);
  });

  it('applies the SECONDARY plan\'s own downgrade rule, independent of the primary', async () => {
    // The two plans disagree: the primary substitutes D2791, the secondary
    // substitutes a cheaper D2790. Each must use its OWN substitute, and the
    // billed code stays D2740 throughout.
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }]);
    await configurePlan(patPlan2Num, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2790' }]);
    await withPlanFeeSchedule(
      plan2Num,
      [
        ['D2740', 180],
        ['D2790', 120],
        ['D2791', 180],
      ],
      async () => {
        const [item] = await estimate();

        expect(item.downgraded).toBe(true);
        expect(item.effectiveCode).toBe('D2791');
        expect(item.primaryInsPortion).toBe(100);

        // The secondary resolves the BILLED code against its OWN rule and prices
        // on its own $120 substitute: (120 - 100) * 50% = 10.
        expect(item.secondaryDowngraded).toBe(true);
        expect(item.secondaryDowngradedFrom).toBe('D2740');
        expect(item.secondaryEffectiveCode).toBe('D2790');
        expect(item.secondaryInsPortion).toBe(10);
        expect(item.ptPortion).toBe(790);
      }
    );
  });

  it('drains the SECONDARY deductible independently of the primary', async () => {
    // The primary's $2000 deductible is fully met, so it charges nothing more.
    // The secondary's own deductible is untouched ($0 met), so ALL of its basis
    // is absorbed before coinsurance. Critically, the primary's
    // `deductibleApplied` must not be credited to the secondary.
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }], {
      metAmount: 2000,
    });
    await configurePlan(patPlan2Num, [], { metAmount: 0 });

    const [item] = await estimate();

    // Primary: (300 - 0) * 50% = 150.
    expect(item.primaryInsPortion).toBe(150);
    // Secondary: (180 - 180) * 50% = 0 — its full basis went to its own deductible.
    expect(item.secondaryInsPortion).toBe(0);
    expect(item.ptPortion).toBe(750);
  });

  it('caps the secondary at the balance remaining after the primary', async () => {
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }]);
    await configurePlan(patPlan2Num, []);
    await withPlanFeeSchedule(plan2Num, [['D2740', 1200]], async () => {
      const [item] = await estimate();

      // remaining = 1200 - 300 write-off - 100 primary = 800.
      const remainingAfterPrimary = CROWN_CHARGE - Number(item.writeoff ?? 0) - item.primaryInsPortion;
      expect(remainingAfterPrimary).toBe(800);
      // Secondary benefit (1200 - 100) * 50% = 550, under the remainder.
      expect(item.secondaryInsPortion).toBe(550);
      expect(item.ptPortion).toBe(250);
    });
  });

  it('caps the secondary when its benefit exceeds the remaining balance', async () => {
    // Raise the primary's substitute fee so the remainder shrinks below what the
    // secondary would otherwise pay. The cap must bind exactly.
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }]);
    await configurePlan(patPlan2Num, []);
    await withPlanFeeSchedule(
      planNum,
      [
        ['D2740', CROWN_CONTRACTED],
        ['D2791', 900],
      ],
      async () => {
        await withPlanFeeSchedule(plan2Num, [['D2740', 1200]], async () => {
          const [item] = await estimate();

          // Primary: (900 - 100) * 50% = 400. Write-off 300. Remainder = 500.
          expect(item.primaryInsPortion).toBe(400);
          // Secondary benefit = 550 > 500 remainder, so it is capped at 500.
          expect(item.secondaryInsPortion).toBe(500);
          expect(item.ptPortion).toBe(0);
        });
      }
    );
  });

  it('never posts a negative secondary amount when the primary consumes the balance', async () => {
    // A primary substitute fee barely above its remaining deductible, plus a
    // large gross charge, is the shape where write-off + primary can approach
    // the gross. The Math.max(0, ...) floor on the remainder is what keeps
    // `secondaryInsPortion` from going negative and flowing into
    // `totalInsPortion`.
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }], {
      deductible: 2000,
      metAmount: 1990,
    });
    await configurePlan(patPlan2Num, []);

    const [item] = await estimate();

    expect(item.secondaryInsPortion).toBeGreaterThanOrEqual(0);
    expect(item.ptPortion).toBeGreaterThanOrEqual(0);
    expect(item.totalInsPortion).toBeGreaterThanOrEqual(0);
    expect(item.insPortion).toBe(item.totalInsPortion);
    // Nothing invented: the patient owes what is left after both plans and the
    // primary's contractual discount.
    expect(item.ptPortion).toBe(
      Math.max(
        0,
        CROWN_CHARGE - Number(item.writeoff ?? 0) - item.primaryInsPortion - item.secondaryInsPortion
      )
    );
  });

  it('does not flag the line when the PRIMARY downgrade was skipped', async () => {
    // D9998 has no allowance anywhere, so the PRIMARY downgrade is skipped as
    // 'no-fee' and the line is priced normally — it must not be marked
    // unestimated, and the secondary still prices independently.
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D9998' }]);
    await configurePlan(patPlan2Num, []);

    const [item] = await estimate();

    expect(item.downgradeSkipped).toBe('no-fee');
    expect(item.downgraded).toBeFalsy();
    expect(item.secondaryNotEstimated).toBeFalsy();
    expect(item.ptPortion).toBeGreaterThan(0);
  });

  it('flags the line only when the SECONDARY\'s own downgrade cannot be priced', async () => {
    // The primary is fine; the secondary's rule substitutes a code it has no
    // fee for. That is a genuinely missing secondary estimate, so the flag must
    // now be set — the mirror image of the case above.
    await configurePlan(patPlanNum, []);
    await configurePlan(patPlan2Num, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D9998' }]);

    const [item] = await estimate();

    expect(item.downgraded).toBeFalsy();
    expect(item.secondaryDowngraded).toBeFalsy();
    expect(item.secondaryDowngradeSkipped).toBe('no-fee');
    expect(item.secondaryNotEstimated).toBe(true);
  });

  it('falls back to the coinsurance split when the secondary has no insplan', async () => {
    // Detach the secondary inssub from its insplan, which is what makes
    // `buildPlanPricingContext` return null: there is then no fee schedule to
    // price the secondary against, and the conservative transfer applies.
    await configurePlan(patPlanNum, []);
    await configurePlan(patPlan2Num, []);
    await prisma.inssub.update({
      where: { InsSubNum: insSub2Num },
      data: { PlanNum: null },
    });
    try {
      const [item] = await estimate();

      // Primary: (900 - 100) * 50% = 400. Patient before split: 500.
      expect(item.primaryInsPortion).toBe(400);
      // Legacy transfer of coinsurance only: 500 - 100 deductible = 400.
      expect(item.secondaryInsPortion).toBe(400);
      expect(item.ptPortion).toBe(100);
      // Unpriceable secondary => the line is reported as unestimated.
      expect(item.secondaryNotEstimated).toBe(true);
    } finally {
      await prisma.inssub.update({
        where: { InsSubNum: insSub2Num },
        data: { PlanNum: plan2Num },
      });
    }
  });
});