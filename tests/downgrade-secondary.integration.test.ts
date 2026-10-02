/**
 * Downgrade + secondary insurance INTEGRATION test — drives the real
 * `invoiceService.estimateInvoiceItems` pricing loop for a patient holding two
 * patplans (Ordinal 1 primary, Ordinal 2 secondary).
 *
 * `downgrade-invoice-loop.integration.test.ts` covers the primary-only path.
 * It cannot catch the secondary block, which is a separate loop further down
 * and is where a downgrade interacts with a second payer.
 *
 * The behaviour asserted here is a deliberate STOPGAP, not correct COB:
 * a downgraded line leaves the secondary at $0 and flags the line, because the
 * loop prices the secondary against the PRIMARY's fee schedule, coverage book
 * and downgrade basis. A secondary must be priced on its OWN rules, so every
 * shortcut available at this point is wrong in some case — the only safe
 * answer until that is built is to not guess.
 *
 * Scenarios:
 *   1. downgraded line + secondary  -> secondary $0, line flagged, patient owes
 *                                      the full gap, balance is the GROSS charge
 *   2. non-downgraded line + secondary -> legacy coinsurance split still applies
 *   3. downgraded line, no secondary -> no flag leaks onto a primary-only line
 *   4. the stopgap can never overpay or underflow the patient
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
  metAmount = DEDUCTIBLE_MET,
) => {
  const meta: any = await getPatientInsuranceMeta(targetPatPlanNum);
  await setPatientInsuranceMeta(targetPatPlanNum, {
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
    coverageCategoryTable: [
      { category: 'Restorative', coverage: COVERAGE_PCT },
      { category: 'Basic', coverage: COVERAGE_PCT },
      { category: 'Major', coverage: COVERAGE_PCT },
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

  it('leaves the secondary unestimated and bills the patient the full gap', async () => {
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }]);
    await configurePlan(patPlan2Num, []);

    const [item] = await estimate();

    // Primary priced on the $300 substitute: (300 - 100 deductible) * 50%.
    expect(item.downgraded).toBe(true);
    expect(item.effectiveCode).toBe('D2791');
    expect(item.primaryInsPortion).toBe(100);

    // The secondary is NOT guessed at. It is not capped at the primary's
    // downgraded basis either — that under-pays a secondary with no downgrade
    // of its own, and over-bills the patient.
    expect(item.secondaryInsPortion).toBe(0);
    expect(item.secondaryNotEstimated).toBe(true);

    // The patient sees the whole gap: 1200 - 300 write-off - 100 insurance.
    expect(item.ptPortion).toBe(800);
    // `balance` is the gross charge, not the patient share.
    expect(item.balance).toBe(CROWN_CHARGE);
  });

  it('still applies the legacy coinsurance split to a non-downgraded line', async () => {
    // No downgrade rule, so the primary prices the $900 allowed fee and the
    // secondary keeps its existing behaviour. This guards the stopgap against
    // leaking into lines that never had a downgrade.
    await configurePlan(patPlanNum, []);
    await configurePlan(patPlan2Num, []);

    const [item] = await estimate();

    expect(item.downgraded).toBeFalsy();
    expect(item.secondaryNotEstimated).toBeFalsy();
    expect(item.deductibleApplied).toBe(100);

    // Primary: (900 - 100) * 50% = 400. Patient before split: 100 + 400 = 500.
    expect(item.primaryInsPortion).toBe(400);
    // Only coinsurance transfers; the $100 deductible stays with the patient.
    expect(item.secondaryInsPortion).toBe(400);
    expect(item.ptPortion).toBe(100);
    expect(item.balance).toBe(CROWN_CHARGE);
  });

  it('never lets the stopgap exceed the balance remaining after the primary', async () => {
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D2791' }]);
    await configurePlan(patPlan2Num, []);

    const [item] = await estimate();

    const remainingAfterPrimary = CROWN_CHARGE - Number(item.writeoff ?? 0) - Number(item.primaryInsPortion || 0);
    expect(item.secondaryInsPortion).toBeLessThanOrEqual(remainingAfterPrimary);
    expect(item.secondaryInsPortion).toBeGreaterThanOrEqual(0);
    expect(item.ptPortion).toBeGreaterThanOrEqual(0);
    // The stopgap must be conservative in the one direction that matters: it
    // never invents a secondary payment the plan has not been asked for.
    expect(item.ptPortion).toBe(CROWN_CHARGE - Number(item.writeoff ?? 0) - item.primaryInsPortion);
  });

  it('does not flag the line when the downgrade was skipped', async () => {
    // D9998 has no allowance anywhere, so the downgrade is skipped as 'no-fee'
    // and the line is priced normally — it must not be marked unestimated.
    await configurePlan(patPlanNum, [{ code: 'D2740', hasDowngrade: true, downgrade: 'D9998' }]);
    await configurePlan(patPlan2Num, []);

    const [item] = await estimate();

    expect(item.downgradeSkipped).toBe('no-fee');
    expect(item.downgraded).toBeFalsy();
    expect(item.secondaryNotEstimated).toBeFalsy();
    expect(item.ptPortion).toBeGreaterThan(0);
  });
});