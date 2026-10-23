/**
 * COB service INTEGRATION test — drives the real pipeline against the real
 * tables (patplan / inssub / insplan / carrier plus the cob_* extensions).
 *
 * cob-rules and cob-pipeline cover the decision logic without a database.
 * What only a database can show is the part the pure tests cannot reach:
 * versioned orders resolving by date of service, patplan.Ordinal staying in
 * step, the plan-COB-change fan-out, payer mismatch blocking a claim, the
 * secondary-claim remittance gate, and a CARC 22 denial landing as DISPUTED.
 */
// MUST be first: enters an unrestricted tenant context for this process.
// The app connects as `medflow_app`, which has no BYPASSRLS, so a test with
// no tenant context runs with app.clinic_ids unset — which every policy in
// prisma/rls/ correctly reads as "no branches", and the fixture's INSERT dies
// with `42501 new row violates row-level security policy`. This is the same
// side-effect import the seed scripts use.
import '../src/config/seed-context';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';
import {
  getPatientInsuranceMeta,
  setPatientInsuranceMeta,
} from '../src/utils/opendental-auth.util';
import { cobService } from '../src/services/cob/cob.service';
import { planMasterService } from '../src/services/cob/plan-master.service';
import { coverageDetailService, setPayerType } from '../src/services/cob/coverage-detail.service';
import {
  getPrimaryRemittanceStatus,
  assertSecondaryClaimAllowed,
  recordRemittanceInLedger,
  getBalanceByResponsibleParty,
  finalizePatientLiabilityIfLastPayer,
  partyForPosition,
} from '../src/services/cob/claim-cob.service';

/**
 * A REAL seeded user. securitylog.UserNum carries an FK to userod, so a
 * synthetic id makes every audit write fail — and writeAudit swallows its own
 * errors by design, so the audit assertions below would pass vacuously while
 * nothing was recorded.
 */
const STAFF = BigInt(1);
const cleanup: Array<() => Promise<unknown>> = [];

let patNum: bigint;
/** Own employer plan (patient is subscriber). */
let ownPatPlan: bigint;
let ownPlanNum: bigint;
let ownInsSub: bigint;
let ownCarrier: bigint;
/** Spouse's plan (patient is a dependent). */
let spousePatPlan: bigint;
let spousePlanNum: bigint;
let spouseInsSub: bigint;
let spouseCarrier: bigint;

const iso = (d: Date | string | null | undefined): string | null =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

/** Open Dental's patplan.Relationship: 0 self, 1 spouse, 2 child. */
const REL_SELF = 0;
const REL_CHILD = 2;

const makeCoverage = async (opts: {
  name: string;
  relationship: number;
  ordinal: number;
  effective: string;
  subscriber?: bigint | null;
}) => {
  const carrier = await getNextId('carrier', 'CarrierNum');
  await prisma.carrier.create({
    data: {
      CarrierNum: carrier,
      CarrierName: `${opts.name} ${patNum}`,
      ElectID: `COB${String(patNum).slice(-5)}${Math.floor(Math.random() * 10000)}`,
    },
  });
  cleanup.push(() => prisma.carrier.delete({ where: { CarrierNum: carrier } }));

  const plan = await getNextId('insplan', 'PlanNum');
  await prisma.insplan.create({
    data: { PlanNum: plan, CarrierNum: carrier, PlanType: '', GroupName: opts.name },
  });
  // `cleanup` is REVERSED at teardown, so push parents first: the reversed
  // list then deletes children before the rows they point at. Getting this
  // backwards leaks fixture rows into the dev database on every run, which is
  // how the FK errors in teardown show up.
  cleanup.push(() => prisma.cob_plan_profile_version.deleteMany({ where: { plan_num: plan } }));
  cleanup.push(() => prisma.cob_plan_profile.deleteMany({ where: { plan_num: plan } }));
  cleanup.push(() => prisma.insplan.delete({ where: { PlanNum: plan } }));

  const insSub = await getNextId('inssub', 'InsSubNum');
  await prisma.inssub.create({
    data: {
      InsSubNum: insSub,
      PlanNum: plan,
      Subscriber: opts.subscriber === undefined ? patNum : opts.subscriber,
      SubscriberID: `MEM${insSub}`,
      DateEffective: new Date(`${opts.effective}T00:00:00.000Z`),
    },
  });

  const patPlan = await getNextId('patplan', 'PatPlanNum');
  await prisma.patplan.create({
    data: {
      PatPlanNum: patPlan,
      PatNum: patNum,
      InsSubNum: insSub,
      Ordinal: opts.ordinal,
      IsPending: 0,
      Relationship: opts.relationship,
    },
  });
  // patplan references inssub, so inssub is pushed FIRST and therefore
  // deleted LAST of the two.
  // deleteMany, not delete: a test may legitimately have removed the coverage
  // through the service already (see the COB-facts cleanup test), and a
  // `delete` on a missing row would throw and report a phantom leak.
  cleanup.push(() => prisma.inssub.deleteMany({ where: { InsSubNum: insSub } }));
  cleanup.push(() => prisma.patplan.deleteMany({ where: { PatPlanNum: patPlan } }));
  cleanup.push(() => prisma.cob_coverage_detail.deleteMany({ where: { patplan_num: patPlan } }));

  return { carrier, plan, insSub, patPlan };
};

/** Wipes every order/report for this patient so each test starts at v1. */
const resetOrders = async () => {
  const orders = await prisma.cob_coverage_order.findMany({
    where: { pat_num: patNum },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  if (ids.length) {
    await prisma.cob_coverage_order_flag.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.cob_coverage_order_position.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.cob_coverage_order.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.cob_payer_reported_coverage.deleteMany({ where: { pat_num: patNum } });
};

describe('COB service (integration)', () => {
  beforeAll(async () => {
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: {
        PatNum: patNum,
        FName: 'Cob',
        LName: `Test${patNum}`,
        Birthdate: new Date('1958-05-20'),
      },
    });
    // `cleanup` is reversed at teardown, so the FIRST push is deleted LAST.
    // The patient goes first here because securitylog, task, inssub and
    // patplan all point at it.
    cleanup.push(() => prisma.patient.delete({ where: { PatNum: patNum } }));
    cleanup.push(() => prisma.cob_coverage_order.deleteMany({ where: { pat_num: patNum } }));
    cleanup.push(() => prisma.cob_responsibility_ledger.deleteMany({ where: { pat_num: patNum } }));
    cleanup.push(() =>
      prisma.cob_payer_reported_coverage.deleteMany({ where: { pat_num: patNum } })
    );
    cleanup.push(() => prisma.task.deleteMany({ where: { KeyNum: patNum } }));
    cleanup.push(() => prisma.tasknote.deleteMany({ where: { task: { KeyNum: patNum } } }));

    // The COB pipeline writes real audit rows, and securitylog carries an FK
    // to the patient — so they have to go before it. securityloghash is the
    // hash-chain row for each one and references securitylog, hence first.
    //
    // Deleting audit rows is only acceptable because these are fixture rows
    // in a dev database. It DOES break verifyAuditChain's continuity for the
    // run, which is inherent to testing an audited code path against a real
    // chain, not something this file can avoid.
    cleanup.push(() => prisma.securitylog.deleteMany({ where: { PatNum: patNum } }));
    cleanup.push(async () => {
      const logs = await prisma.securitylog.findMany({
        where: { PatNum: patNum },
        select: { SecurityLogNum: true },
      });
      if (!logs.length) return;
      return prisma.securityloghash.deleteMany({
        where: { SecurityLogNum: { in: logs.map((l) => l.SecurityLogNum) } },
      });
    });

    const own = await makeCoverage({
      name: 'Own Employer',
      relationship: REL_SELF,
      ordinal: 1,
      effective: '2015-01-01',
    });
    ownCarrier = own.carrier;
    ownPlanNum = own.plan;
    ownInsSub = own.insSub;
    ownPatPlan = own.patPlan;

    const spouse = await makeCoverage({
      name: 'Spouse Employer',
      relationship: REL_CHILD,
      ordinal: 2,
      effective: '2022-01-01',
      // Not a patient here — the usual case for the other subscriber.
      subscriber: null,
    });
    spouseCarrier = spouse.carrier;
    spousePlanNum = spouse.plan;
    spouseInsSub = spouse.insSub;
    spousePatPlan = spouse.patPlan;
  });

  afterAll(async () => {
    const failures: string[] = [];
    for (const fn of cleanup.reverse()) {
      try {
        await fn();
      } catch (err: any) {
        failures.push(err?.message ?? String(err));
      }
    }
    if (failures.length) {
      console.warn('COB integration teardown left rows behind:', failures);
    }
  });

  beforeEach(async () => {
    await resetOrders();
    await prisma.cob_coverage_detail.deleteMany({
      where: { patplan_num: { in: [ownPatPlan, spousePatPlan] } },
    });
    await prisma.cob_plan_profile.deleteMany({
      where: { plan_num: { in: [ownPlanNum, spousePlanNum] } },
    });
    await prisma.cob_plan_profile_version.deleteMany({
      where: { plan_num: { in: [ownPlanNum, spousePlanNum] } },
    });
    await prisma.cob_payer_profile.deleteMany({
      where: { carrier_num: { in: [ownCarrier, spouseCarrier] } },
    });
  });

  // ── Facts loading ───────────────────────────────────────────────────────

  it('reads coverage facts out of the Open Dental tables', async () => {
    const coverages = await cobService.listCoverages(patNum.toString(), '2026-03-01');
    expect(coverages).toHaveLength(2);

    const own = coverages.find((c) => c.id === ownPatPlan.toString())!;
    expect(own.relationship).toBe('SELF');
    expect(own.effectiveDate).toBe('2015-01-01');
    expect(own.activeOnDate).toBe(true);
    // Defaults with nothing recorded: coordinates, medical, method unknown.
    expect(own.coordinatesBenefits).toBe(true);
    expect(own.benefitCategory).toBe('MEDICAL');
    expect(own.cobPaymentMethod).toBe('UNKNOWN');
    expect(own.payerType).toBe('COMMERCIAL');

    const dependent = coverages.find((c) => c.id === spousePatPlan.toString())!;
    expect(dependent.relationship).toBe('PARENT');
  });

  it('prefers the subscriber patient record for the DOB, then the override', async () => {
    // The patient subscribes to their own plan, so the DOB comes from the
    // patient row without anybody entering it twice.
    let coverages = await cobService.listCoverages(patNum.toString());
    expect(coverages.find((c) => c.id === ownPatPlan.toString())!.subscriberBirthdate).toBe(
      '1958-05-20'
    );
    // The other subscriber is not a patient here, so it has to be recorded.
    expect(coverages.find((c) => c.id === spousePatPlan.toString())!.subscriberBirthdate).toBeNull();

    await coverageDetailService.upsert(
      spousePatPlan.toString(),
      { subscriberName: 'Other Parent', subscriberBirthdate: '1960-02-14' },
      STAFF
    );
    coverages = await cobService.listCoverages(patNum.toString());
    expect(coverages.find((c) => c.id === spousePatPlan.toString())!.subscriberBirthdate).toBe(
      '1960-02-14'
    );
  });

  // ── Versioned orders ────────────────────────────────────────────────────

  it('saves a version with positions, explanations and a verification status', async () => {
    const order = await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-01-01',
      userNum: STAFF,
    });

    expect(order.version).toBe(1);
    expect(order.status).toBe('SUGGESTED');
    expect(order.isCurrent).toBe(true);
    expect(order.effectiveFrom).toBe('2026-01-01');
    expect(order.verification.status).toBe('UNVERIFIED');
    expect(order.positions.map((p: any) => p.coverageId)).toEqual([
      ownPatPlan.toString(),
      spousePatPlan.toString(),
    ]);
    expect(order.positions[0].ruleCode).toBe('SUBSCRIBER_BEFORE_DEPENDENT');
    expect(order.positions[0].explanation).toContain('own policy');
  });

  it('writes the suggested order back onto patplan.Ordinal', async () => {
    // Every existing consumer — claims, EDI 837, the invoice estimator, the
    // ERA poster — reads Ordinal, so it has to track the current order.
    await prisma.patplan.update({ where: { PatPlanNum: ownPatPlan }, data: { Ordinal: 9 } });
    await prisma.patplan.update({ where: { PatPlanNum: spousePatPlan }, data: { Ordinal: 8 } });

    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });

    const rows = await prisma.patplan.findMany({
      where: { PatNum: patNum },
      orderBy: { Ordinal: 'asc' },
    });
    expect(rows.map((r) => r.PatPlanNum.toString())).toEqual([
      ownPatPlan.toString(),
      spousePatPlan.toString(),
    ]);
    expect(rows[0].Ordinal).toBe(1);
    expect(rows[1].Ordinal).toBe(2);
  });

  it('a claim for a date BEFORE a coverage change uses the OLD order', async () => {
    // The scenario that makes versioning worth the trouble: a claim keyed in
    // today for a February visit must bill February's order.
    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-01-01',
      userNum: STAFF,
    });

    // Something changes in June; the pipeline now ranks the spouse's plan
    // first because that plan turns out to have no COB provision.
    await planMasterService.updateCobFields(
      spousePlanNum.toString(),
      { coordinatesBenefits: false },
      STAFF
    );
    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-06-01',
      triggerReason: 'COVERAGE_EDITED',
      userNum: STAFF,
    });

    const march = await cobService.getOrderForDate(patNum.toString(), '2026-03-15');
    const july = await cobService.getOrderForDate(patNum.toString(), '2026-07-15');

    expect(march!.version).toBe(1);
    expect(march!.positions[0].coverageId).toBe(ownPatPlan.toString());
    expect(march!.effectiveTo).toBe('2026-05-31');

    expect(july!.version).toBeGreaterThan(1);
    expect(july!.positions[0].coverageId).toBe(spousePatPlan.toString());
    expect(july!.positions[0].ruleCode).toBe('NO_COB_PROVISION');
  });

  it('never overwrites a version — history keeps every suggestion', async () => {
    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-01-01',
      userNum: STAFF,
    });
    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-02-01',
      userNum: STAFF,
    });
    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-03-01',
      userNum: STAFF,
    });

    const history = await cobService.getOrderHistory(patNum.toString());
    expect(history).toHaveLength(3);
    expect(history.map((o) => o.version)).toEqual([3, 2, 1]);
    // Exactly one open range.
    expect(history.filter((o) => o.isCurrent)).toHaveLength(1);
  });

  it('reports NEEDS_INFO with the field to fill in, and blocks the claim', async () => {
    // Make both coverages dependent-child policies with a missing DOB on one.
    await prisma.patplan.update({
      where: { PatPlanNum: ownPatPlan },
      data: { Relationship: REL_CHILD },
    });
    await coverageDetailService.upsert(
      ownPatPlan.toString(),
      { custodyArrangement: 'TOGETHER' },
      STAFF
    );
    await coverageDetailService.upsert(
      spousePatPlan.toString(),
      { custodyArrangement: 'TOGETHER' },
      STAFF
    );

    try {
      const order = await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });
      expect(order.status).toBe('NEEDS_INFO');
      expect(order.positions).toEqual([]);
      expect(order.missingFields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            coverageId: spousePatPlan.toString(),
            field: 'subscriberBirthdate',
          }),
        ])
      );

      const check = await cobService.checkSubmittable(patNum.toString(), '2026-03-01');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('needs information');
      expect(check.reason).toContain('subscriberBirthdate');
    } finally {
      await prisma.patplan.update({
        where: { PatPlanNum: ownPatPlan },
        data: { Relationship: REL_SELF },
      });
    }
  });

  // ── Override ────────────────────────────────────────────────────────────

  it('an override is a new version carrying the reason, and moves Ordinal', async () => {
    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });

    const order = await cobService.overrideOrder(
      patNum.toString(),
      [spousePatPlan.toString(), ownPatPlan.toString()],
      "Aetna confirmed by phone on 2026-03-02 that they are secondary to the spouse's plan",
      STAFF
    );

    expect(order.status).toBe('STAFF_OVERRIDE');
    expect(order.version).toBe(2);
    expect(order.override!.reason).toContain('Aetna confirmed by phone');
    expect(order.override!.userNum).toBe(STAFF.toString());
    expect(order.positions.map((p: any) => p.coverageId)).toEqual([
      spousePatPlan.toString(),
      ownPatPlan.toString(),
    ]);
    // The rules' own reasoning is kept alongside the override.
    expect(order.positions[1].explanation).toContain('the rules had said');

    const rows = await prisma.patplan.findMany({ where: { PatNum: patNum } });
    expect(rows.find((r) => r.PatPlanNum === spousePatPlan)!.Ordinal).toBe(1);

    // And the suggestion it replaced is still readable.
    const history = await cobService.getOrderHistory(patNum.toString());
    expect(history.find((o) => o.version === 1)!.status).toBe('SUGGESTED');
  });

  it('rejects an override with no reason', async () => {
    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });
    await expect(
      cobService.overrideOrder(
        patNum.toString(),
        [spousePatPlan.toString(), ownPatPlan.toString()],
        '   ',
        STAFF
      )
    ).rejects.toThrow(/reason is required/i);
  });

  it('rejects an override naming a coverage from another patient', async () => {
    await expect(
      cobService.overrideOrder(patNum.toString(), ['999999999'], 'a perfectly good reason', STAFF)
    ).rejects.toThrow(/does not belong to this patient/i);
  });

  it('rejects an override that puts a fixed-indemnity policy in the sequence', async () => {
    // It is not billable in the claim's order, so a human must not be able to
    // place it there either.
    await planMasterService.updateCobFields(
      spousePlanNum.toString(),
      { benefitCategory: 'FIXED_INDEMNITY' },
      STAFF
    );
    await expect(
      cobService.overrideOrder(
        patNum.toString(),
        [spousePatPlan.toString(), ownPatPlan.toString()],
        'staff insists on this order',
        STAFF
      )
    ).rejects.toThrow(/does not take part in claim coordination/i);
  });

  it('keeps an override across a re-evaluation and raises COVERAGE_CHANGED', async () => {
    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });
    await cobService.overrideOrder(
      patNum.toString(),
      [spousePatPlan.toString(), ownPatPlan.toString()],
      'payer confirmed the reversed order by phone',
      STAFF
    );

    const after = await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-07-01',
      triggerReason: 'COVERAGE_EDITED',
      userNum: STAFF,
    });

    expect(after.status).toBe('STAFF_OVERRIDE');
    expect(after.positions[0].coverageId).toBe(spousePatPlan.toString());
    expect(after.flags.map((f: any) => f.flag)).toContain('COVERAGE_CHANGED');
    expect(after.override!.reason).toContain('payer confirmed');
  });

  it('keeps a staff override even when the rules then go NEEDS_INFO', async () => {
    // The regression this pins: an override is a decision a biller made after
    // speaking to a payer. A later re-evaluation that cannot answer some
    // unrelated rule must not throw that away — the override survives and
    // COVERAGE_CHANGED tells the biller to look again.
    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-01-01',
      userNum: STAFF,
    });
    await cobService.overrideOrder(
      patNum.toString(),
      [spousePatPlan.toString(), ownPatPlan.toString()],
      'Confirmed with both payers on 2026-01-15 that this is the order they expect',
      STAFF
    );

    // Now make the rules unanswerable: two dependent-child policies, one with
    // no subscriber DOB.
    await prisma.patplan.update({
      where: { PatPlanNum: ownPatPlan },
      data: { Relationship: REL_CHILD },
    });
    try {
      await coverageDetailService.upsert(
        ownPatPlan.toString(),
        { custodyArrangement: 'TOGETHER' },
        STAFF
      );
      await coverageDetailService.upsert(
        spousePatPlan.toString(),
        { custodyArrangement: 'TOGETHER' },
        STAFF
      );

      const order = await cobService.getCurrentOrder(patNum.toString());
      expect(order!.status).toBe('STAFF_OVERRIDE');
      expect(order!.override!.reason).toContain('Confirmed with both payers');
      expect(order!.positions.map((p: any) => p.coverageId)).toEqual([
        spousePatPlan.toString(),
        ownPatPlan.toString(),
      ]);
      expect(order!.flags.map((f: any) => f.flag)).toContain('COVERAGE_CHANGED');
    } finally {
      await prisma.patplan.update({
        where: { PatPlanNum: ownPatPlan },
        data: { Relationship: REL_SELF },
      });
    }
  });

  // ── Fixed-benefit exclusion ─────────────────────────────────────────────

  it('lists a fixed-indemnity policy separately instead of ranking it', async () => {
    await planMasterService.updateCobFields(
      spousePlanNum.toString(),
      { benefitCategory: 'FIXED_INDEMNITY' },
      STAFF
    );
    const order = await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });

    expect(order.positions.map((p: any) => p.coverageId)).toEqual([ownPatPlan.toString()]);
    expect(order.excludedCoverages).toHaveLength(1);
    expect(order.excludedCoverages[0].coverageId).toBe(spousePatPlan.toString());
    expect(order.excludedCoverages[0].explanation).toContain('pays the patient a set amount');
  });

  // ── Plan master ─────────────────────────────────────────────────────────

  it('versions every plan COB field change with a diff', async () => {
    await planMasterService.updateCobFields(
      ownPlanNum.toString(),
      { cobPaymentMethod: 'NON_DUPLICATION', cobInfoSource: 'PAYER_CONFIRMED' },
      STAFF,
      { changeNote: 'Confirmed with the plan administrator' }
    );
    const second = await planMasterService.updateCobFields(
      ownPlanNum.toString(),
      { cobPaymentMethod: 'STANDARD' },
      STAFF
    );

    expect(second.version).toBe(2);
    expect(second.changed).toMatchObject({
      cobPaymentMethod: { from: 'NON_DUPLICATION', to: 'STANDARD' },
    });

    const plan = await planMasterService.getPlan(ownPlanNum.toString());
    expect(plan.history).toHaveLength(2);
    expect(plan.history[0].version).toBe(2);
    expect((plan.history[1].snapshot as any).changed.cobPaymentMethod.to).toBe('NON_DUPLICATION');
    expect(plan.history[1].changeNote).toBe('Confirmed with the plan administrator');
    expect(plan.cobProfileRecorded).toBe(true);
  });

  it('shows unrecorded plans as defaults, not as confirmed facts', async () => {
    const plan = await planMasterService.getPlan(spousePlanNum.toString());
    expect(plan.cobProfileRecorded).toBe(false);
    expect(plan.cobInfoSource).toBe('DEFAULT');
    expect(plan.cobPaymentMethod).toBe('UNKNOWN');
    expect(plan.version).toBe(0);
  });

  it('rejects an invalid COB field value', async () => {
    await expect(
      planMasterService.updateCobFields(
        ownPlanNum.toString(),
        { cobPaymentMethod: 'WHATEVER_THE_UI_SENT' } as any,
        STAFF
      )
    ).rejects.toThrow(/cobPaymentMethod must be one of/);
  });

  it('rejects an update with no COB field at all', async () => {
    await expect(
      planMasterService.updateCobFields(ownPlanNum.toString(), {}, STAFF)
    ).rejects.toThrow(/At least one COB field/);
  });

  it('re-evaluates patients on the plan who have an OPEN claim', async () => {
    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });
    const before = await cobService.getCurrentOrder(patNum.toString());

    // An unsent claim: open money, so this patient is in scope.
    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patNum,
        PlanNum: ownPlanNum,
        InsSubNum: ownInsSub,
        ClaimStatus: 'W',
        DateService: new Date('2026-03-01T00:00:00.000Z'),
        ClaimFee: 500,
      },
    });

    try {
      const result = await planMasterService.updateCobFields(
        spousePlanNum.toString(),
        { coordinatesBenefits: false },
        STAFF
      );

      expect(result.reEvaluated.map((r) => r.patientId)).toContain(patNum.toString());

      const after = await cobService.getCurrentOrder(patNum.toString());
      expect(after!.version).toBeGreaterThan(before!.version);
      expect(after!.triggerReason).toBe(`PLAN_COB_CHANGED:${spousePlanNum}`);
      // The new fact actually changed who is primary.
      expect(after!.positions[0].coverageId).toBe(spousePatPlan.toString());
    } finally {
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    }
  });

  it('leaves patients with no open claim alone', async () => {
    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });
    const before = await cobService.getCurrentOrder(patNum.toString());

    // A received-and-paid claim is settled: re-ranking would rewrite history
    // for no billing benefit and bury the real changes in noise.
    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patNum,
        PlanNum: ownPlanNum,
        ClaimStatus: 'R',
        InsPayAmt: 400,
        DateService: new Date('2025-03-01T00:00:00.000Z'),
        DateReceived: new Date('2025-04-01T00:00:00.000Z'),
      },
    });

    try {
      const result = await planMasterService.updateCobFields(
        spousePlanNum.toString(),
        { cobInfoSource: 'PLAN_DOCUMENT' },
        STAFF
      );
      expect(result.reEvaluated.map((r) => r.patientId)).not.toContain(patNum.toString());

      const after = await cobService.getCurrentOrder(patNum.toString());
      expect(after!.version).toBe(before!.version);
    } finally {
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    }
  });

  // ── Payer-reported coverage and PAYER_MISMATCH ──────────────────────────

  it('a payer reporting a different order raises PAYER_MISMATCH and blocks the claim', async () => {
    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });

    // Our rules say the patient's own plan is primary. The spouse's plan's
    // carrier says IT is primary. The insurer's records decide what they pay,
    // so this has to be settled by a human before anything is billed.
    const result = await cobService.recordPayerReportedCoverage(
      {
        patientId: patNum.toString(),
        coverageId: spousePatPlan.toString(),
        reportedSelfOrder: 1,
        reportedIsActive: true,
        otherPayerName: 'Own Employer',
        source: 'PHONE',
        note: 'Spoke to Maria in benefits, ref #88213',
      },
      STAFF
    );

    const flags = result.order!.flags.filter((f: any) => !f.resolvedAt).map((f: any) => f.flag);
    expect(flags).toContain('PAYER_MISMATCH');

    const mismatch = result.order!.flags.find((f: any) => f.flag === 'PAYER_MISMATCH');
    expect((mismatch!.detail as any).explanation).toContain('primary');
    expect((mismatch!.detail as any).explanation).toContain('secondary');

    // The order itself is NOT changed to match the payer.
    expect(result.order!.positions[0].coverageId).toBe(ownPatPlan.toString());

    const blocked = await cobService.checkSubmittable(patNum.toString(), '2026-03-01');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('PAYER_MISMATCH');
  });

  it('resolving the mismatch flag unblocks the claim', async () => {
    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });
    const { order } = await cobService.recordPayerReportedCoverage(
      {
        patientId: patNum.toString(),
        coverageId: spousePatPlan.toString(),
        reportedSelfOrder: 1,
        reportedIsActive: true,
        source: 'PORTAL',
      },
      STAFF
    );

    expect((await cobService.checkSubmittable(patNum.toString(), '2026-03-01')).allowed).toBe(false);

    const resolved = await cobService.resolveFlag(
      order!.id,
      'PAYER_MISMATCH',
      'Called the payer; their file was stale and they have corrected it. Our order stands.',
      STAFF
    );
    const flag = resolved.flags.find((f: any) => f.flag === 'PAYER_MISMATCH')!;
    expect(flag.resolvedAt).not.toBeNull();
    expect(flag.resolutionNote).toContain('their file was stale');

    expect((await cobService.checkSubmittable(patNum.toString(), '2026-03-01')).allowed).toBe(true);
  });

  it('records a verification when the payer confirms active coverage and its position', async () => {
    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });
    await cobService.recordPayerReportedCoverage(
      {
        patientId: patNum.toString(),
        coverageId: ownPatPlan.toString(),
        reportedSelfOrder: 1,
        reportedIsActive: true,
        reportedDate: '2026-02-20',
        source: 'ELIGIBILITY_271',
      },
      STAFF
    );

    const order = await cobService.getCurrentOrder(patNum.toString());
    expect(order!.verification.status).toBe('VERIFIED_WITH_PAYER');
    expect(order!.verification.source).toBe('ELIGIBILITY_271');
    expect(order!.verification.date).toBe('2026-02-20');
    // Agreement, so no mismatch flag.
    expect(order!.flags.filter((f: any) => f.flag === 'PAYER_MISMATCH' && !f.resolvedAt)).toHaveLength(
      0
    );
  });

  it('a newer payer report that now agrees clears the mismatch automatically', async () => {
    await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });
    await cobService.recordPayerReportedCoverage(
      {
        patientId: patNum.toString(),
        coverageId: ownPatPlan.toString(),
        reportedSelfOrder: 2,
        reportedIsActive: true,
        reportedDate: '2026-01-10',
        source: 'PHONE',
      },
      STAFF
    );
    let order = await cobService.getCurrentOrder(patNum.toString());
    expect(order!.flags.some((f: any) => f.flag === 'PAYER_MISMATCH' && !f.resolvedAt)).toBe(true);

    await cobService.recordPayerReportedCoverage(
      {
        patientId: patNum.toString(),
        coverageId: ownPatPlan.toString(),
        reportedSelfOrder: 1,
        reportedIsActive: true,
        reportedDate: '2026-02-10',
        source: 'PHONE',
      },
      STAFF
    );
    order = await cobService.getCurrentOrder(patNum.toString());
    const mismatch = order!.flags.find((f: any) => f.flag === 'PAYER_MISMATCH')!;
    expect(mismatch.resolvedAt).not.toBeNull();
    expect(mismatch.resolutionNote).toContain('now agrees');
  });

  it('rejects a payer report naming a coverage from another patient', async () => {
    await expect(
      cobService.recordPayerReportedCoverage(
        { patientId: patNum.toString(), coverageId: '999999999', source: 'PHONE' },
        STAFF
      )
    ).rejects.toThrow(/does not belong to this patient/i);
  });

  it('rejects a resolution with no note', async () => {
    const order = await cobService.evaluateAndSave(patNum.toString(), { userNum: STAFF });
    await expect(
      cobService.resolveFlag(order.id, 'PAYER_MISMATCH', '  ', STAFF)
    ).rejects.toThrow(/resolution note is required/i);
  });

  // ── Secondary claim gate ────────────────────────────────────────────────

  describe('secondary claims', () => {
    let primaryClaim: bigint;

    beforeEach(async () => {
      primaryClaim = await getNextId('claim', 'ClaimNum');
      await prisma.claim.create({
        data: {
          ClaimNum: primaryClaim,
          PatNum: patNum,
          PlanNum: ownPlanNum,
          InsSubNum: ownInsSub,
          ClaimStatus: 'S', // sent, nothing back yet
          ClaimType: 'Primary',
          DateService: new Date('2026-03-01T00:00:00.000Z'),
          ClaimFee: 1000,
          Narrative: JSON.stringify({ insuranceType: 'primary' }),
        },
      });
    });

    it('refuses a secondary claim before the primary remittance is posted', async () => {
      const status = await getPrimaryRemittanceStatus(primaryClaim);
      expect(status.posted).toBe(false);
      expect(status.reason).toContain('no posted remittance yet');
      expect(status.reason).toContain('Post the primary');

      await expect(assertSecondaryClaimAllowed(primaryClaim)).rejects.toThrow(
        /no posted remittance yet/i
      );

      await prisma.claim.delete({ where: { ClaimNum: primaryClaim } });
    });

    it('allows it once the remittance is posted, carrying the primary payment detail', async () => {
      const procNum = await getNextId('claimproc', 'ClaimProcNum');
      await prisma.claimproc.create({
        data: {
          ClaimProcNum: procNum,
          ClaimNum: primaryClaim,
          PatNum: patNum,
          PlanNum: ownPlanNum,
          Status: 1,
          FeeBilled: 1000,
          InsPayAmt: 560,
          WriteOff: 200,
          DedApplied: 100,
          ClaimAdjReasonCodes: 'CO-45: $200; PR-1: $100; PR-2: $140',
        },
      });
      await prisma.claim.update({
        where: { ClaimNum: primaryClaim },
        data: {
          ClaimStatus: 'R',
          DateReceived: new Date('2026-03-20T00:00:00.000Z'),
          InsPayAmt: 560,
          WriteOff: 200,
        },
      });

      try {
        const status = await assertSecondaryClaimAllowed(primaryClaim);
        expect(status.posted).toBe(true);
        expect(status.paidAmount).toBe(560);
        // Allowed = billed less the contractual write-off.
        expect(status.allowedAmount).toBe(800);
        expect(status.patientResponsibility).toBe(240);
        expect(status.remittanceDate).toBe('2026-03-20');
        // The payer's own group and reason codes, parsed back out.
        expect(status.adjustments).toEqual(
          expect.arrayContaining([
            { groupCode: 'CO', reasonCode: '45', amount: 200 },
            { groupCode: 'PR', reasonCode: '1', amount: 100 },
            { groupCode: 'PR', reasonCode: '2', amount: 140 },
          ])
        );
      } finally {
        await prisma.claimproc.delete({ where: { ClaimProcNum: procNum } });
        await prisma.claim.delete({ where: { ClaimNum: primaryClaim } });
      }
    });

    it('treats a $0 denial as a posted remittance', async () => {
      // A denial IS an adjudication. The secondary is entitled to see it, and
      // this is exactly the population that needs the secondary billed.
      await prisma.claim.update({
        where: { ClaimNum: primaryClaim },
        data: {
          ClaimStatus: 'D',
          DateReceived: new Date('2026-03-20T00:00:00.000Z'),
          InsPayAmt: 0,
        },
      });
      try {
        const status = await getPrimaryRemittanceStatus(primaryClaim);
        expect(status.posted).toBe(true);
        expect(status.paidAmount).toBe(0);
      } finally {
        await prisma.claim.delete({ where: { ClaimNum: primaryClaim } });
      }
    });

    it('blocks a secondary claim when the coverage order is disputed', async () => {
      await cobService.evaluateAndSave(patNum.toString(), {
        effectiveFrom: '2026-01-01',
        userNum: STAFF,
      });
      await prisma.claim.update({
        where: { ClaimNum: primaryClaim },
        data: { ClaimStatus: 'R', DateReceived: new Date('2026-03-20T00:00:00.000Z') },
      });

      // A CARC 22 on the primary disputes the order itself.
      await cobService.handleCobDenial({
        claimNum: primaryClaim,
        adjustments: [{ groupCode: 'OA', reasonCode: '22', amount: 1000 }],
        userNum: STAFF,
      });

      try {
        await expect(assertSecondaryClaimAllowed(primaryClaim)).rejects.toThrow(
          /COB_DENIAL|cannot be billed|DISPUTED/i
        );
      } finally {
        await prisma.claim.delete({ where: { ClaimNum: primaryClaim } });
      }
    });
  });

  // ── COB denial ──────────────────────────────────────────────────────────

  it('a CARC 22 denial sets the order DISPUTED, flags COB_DENIAL and makes a task', async () => {
    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-01-01',
      userNum: STAFF,
    });

    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patNum,
        PlanNum: ownPlanNum,
        ClaimStatus: 'D',
        DateService: new Date('2026-03-01T00:00:00.000Z'),
        DateReceived: new Date('2026-03-25T00:00:00.000Z'),
        ClaimFee: 1000,
      },
    });

    try {
      const result = await cobService.handleCobDenial({
        claimNum,
        adjustments: [
          { groupCode: 'CO', reasonCode: '45', amount: 100 },
          { groupCode: 'OA', reasonCode: '22', amount: 900 },
        ],
        userNum: STAFF,
      });

      expect(result.handled).toBe(true);
      expect(result.detection.isCobDenial).toBe(true);
      expect(result.suggestedAction).toBe('RE_VERIFY_ELIGIBILITY');
      expect(result.taskNum).toBeTruthy();

      const order = await cobService.getCurrentOrder(patNum.toString());
      expect(order!.status).toBe('DISPUTED');
      const flag = order!.flags.find((f: any) => f.flag === 'COB_DENIAL')!;
      expect(flag).toBeTruthy();
      expect((flag.detail as any).claimNum).toBe(claimNum.toString());
      expect((flag.detail as any).explanation).toContain('Re-verify eligibility');

      // And the claim is blocked until a human deals with it.
      const check = await cobService.checkSubmittable(patNum.toString(), '2026-03-01');
      expect(check.allowed).toBe(false);

      // Resolving the denial puts the order back into a billable state.
      await cobService.resolveFlag(
        order!.id,
        'COB_DENIAL',
        'Re-verified with the payer: they had the patient on an old group. Corrected on their end, resubmitting.',
        STAFF
      );
      const after = await cobService.getCurrentOrder(patNum.toString());
      expect(after!.status).toBe('SUGGESTED');
      expect((await cobService.checkSubmittable(patNum.toString(), '2026-03-01')).allowed).toBe(true);
    } finally {
      // The task this created is removed by the file's global teardown, which
      // deletes tasknote before task; doing it here would trip that FK.
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    }
  });

  it('does not raise a COB denial for an ordinary contractual adjustment', async () => {
    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patNum,
        PlanNum: ownPlanNum,
        ClaimStatus: 'R',
        DateService: new Date('2026-03-01T00:00:00.000Z'),
      },
    });
    try {
      const result = await cobService.handleCobDenial({
        claimNum,
        adjustments: [{ groupCode: 'CO', reasonCode: '45', amount: 200 }],
        userNum: STAFF,
      });
      expect(result.handled).toBe(false);
    } finally {
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    }
  });

  // ── Responsibility ledger ───────────────────────────────────────────────

  it('records contractual adjustments as their own non-patient-billable entries', async () => {
    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: { ClaimNum: claimNum, PatNum: patNum, PlanNum: ownPlanNum, ClaimStatus: 'R' },
    });
    const statementNum = await getNextId('statement', 'StatementNum');
    await prisma.statement.create({
      data: { StatementNum: statementNum, PatNum: patNum, IsInvoice: 1 },
    });

    try {
      await recordRemittanceInLedger({
        claimNum,
        patNum,
        statementNum,
        position: 1,
        paidAmount: 560,
        adjustments: [
          { groupCode: 'CO', reasonCode: '45', amount: 200 },
          { groupCode: 'PR', reasonCode: '1', amount: 100 },
          { groupCode: 'PR', reasonCode: '2', amount: 140 },
          // An unrecognised group must NOT default to the patient's column.
          { groupCode: 'OA', reasonCode: '23', amount: 25 },
        ],
      });

      const balance = await getBalanceByResponsibleParty(statementNum);
      expect(balance.contractualAdjustmentsTotal).toBe(200);
      expect(balance.contractualAdjustmentsAreBillableToPatient).toBe(false);

      const primary = balance.byParty.find((p) => p.responsibleParty === 'PRIMARY')!;
      expect(primary.payments).toBe(560);
      expect(primary.contractualAdjustments).toBe(200);

      const patient = balance.byParty.find((p) => p.responsibleParty === 'PATIENT')!;
      // Only the PR-group amounts reach the patient: 100 + 140.
      expect(patient.charges).toBe(240);

      const rows = await prisma.cob_responsibility_ledger.findMany({
        where: { statement_num: statementNum },
      });
      const contractual = rows.find((r) => r.entry_type === 'CONTRACTUAL_ADJUSTMENT')!;
      expect(contractual.billable_to_patient).toBe(false);
      expect(contractual.group_code).toBe('CO');
      const unknownGroup = rows.find((r) => r.group_code === 'OA')!;
      expect(unknownGroup.billable_to_patient).toBe(false);
      expect(unknownGroup.responsible_party).toBe('PRIMARY');
    } finally {
      await prisma.cob_responsibility_ledger.deleteMany({ where: { statement_num: statementNum } });
      await prisma.cob_invoice_liability.deleteMany({ where: { statement_num: statementNum } });
      await prisma.statement.delete({ where: { StatementNum: statementNum } });
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    }
  });

  it('maps order positions onto responsible parties', () => {
    expect(partyForPosition(1)).toBe('PRIMARY');
    expect(partyForPosition(2)).toBe('SECONDARY');
    expect(partyForPosition(3)).toBe('TERTIARY');
    expect(partyForPosition(4)).toBe('TERTIARY');
  });

  // ── Patient liability finalization ──────────────────────────────────────

  it('does not finalize patient liability until the LAST payer has paid', async () => {
    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-01-01',
      userNum: STAFF,
    });

    const statementNum = await getNextId('statement', 'StatementNum');
    await prisma.statement.create({
      data: { StatementNum: statementNum, PatNum: patNum, IsInvoice: 1 },
    });
    const primaryClaim = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: primaryClaim,
        PatNum: patNum,
        PlanNum: ownPlanNum,
        InsSubNum: ownInsSub,
        ClaimStatus: 'R',
        DateService: new Date('2026-03-01T00:00:00.000Z'),
        Narrative: JSON.stringify({ invoiceId: statementNum.toString() }),
      },
    });
    const secondaryClaim = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: secondaryClaim,
        PatNum: patNum,
        PlanNum: spousePlanNum,
        InsSubNum: spouseInsSub,
        ClaimStatus: 'R',
        DateService: new Date('2026-03-01T00:00:00.000Z'),
        Narrative: JSON.stringify({ invoiceId: statementNum.toString() }),
      },
    });

    try {
      // Payer 1 of 2: the patient still has money coming from the secondary.
      const first = await finalizePatientLiabilityIfLastPayer({ claimNum: primaryClaim });
      expect(first.finalized).toBe(false);
      expect(first.reason).toContain('payer 1 of 2');
      expect(
        (await prisma.cob_invoice_liability.findUnique({ where: { statement_num: statementNum } }))
          ?.patient_liability_finalized_at ?? null
      ).toBeNull();

      // Payer 2 of 2: now the balance is final.
      const second = await finalizePatientLiabilityIfLastPayer({
        claimNum: secondaryClaim,
        userNum: STAFF,
      });
      expect(second.finalized).toBe(true);
      expect(second.reason).toContain('last payer');

      const liability = await prisma.cob_invoice_liability.findUnique({
        where: { statement_num: statementNum },
      });
      expect(liability!.patient_liability_finalized_at).not.toBeNull();
      expect(liability!.last_payer_claim_num).toBe(secondaryClaim);

      const balance = await getBalanceByResponsibleParty(statementNum);
      expect(balance.patientLiabilityFinalizedAt).not.toBeNull();
    } finally {
      await prisma.cob_invoice_liability.deleteMany({ where: { statement_num: statementNum } });
      await prisma.claim.deleteMany({ where: { ClaimNum: { in: [primaryClaim, secondaryClaim] } } });
      await prisma.statement.delete({ where: { StatementNum: statementNum } });
    }
  });

  // ── Coverage detail and payer type ──────────────────────────────────────

  it('answers a NEEDS_INFO by recording the missing fact', async () => {
    // Medicare meets an active employer plan, and the employer size band is
    // the whole rule.
    await setPayerType(spouseCarrier.toString(), 'MEDICARE', STAFF);
    await coverageDetailService.upsert(
      spousePatPlan.toString(),
      { coverageBasis: 'MEDICARE', medicareEntitlementReason: 'AGE' },
      STAFF
    );
    await prisma.patplan.update({
      where: { PatPlanNum: spousePatPlan },
      data: { Relationship: REL_SELF },
    });

    try {
      let order = await coverageDetailService.upsert(
        ownPatPlan.toString(),
        { coverageBasis: 'EMPLOYER_GROUP', subscriberEmploymentStatus: 'ACTIVE' },
        STAFF
      );
      expect(order.order!.status).toBe('NEEDS_INFO');
      expect((order.order!.missingFields as any[]).some((m) => m.field === 'employerSizeBand')).toBe(
        true
      );

      // 25 employees: the group plan pays first.
      order = await coverageDetailService.upsert(
        ownPatPlan.toString(),
        { employerSizeBand: '20_TO_99' },
        STAFF
      );
      expect(order.order!.status).toBe('SUGGESTED');
      expect(order.order!.positions[0].coverageId).toBe(ownPatPlan.toString());
      expect(order.order!.positions[0].ruleCode).toBe('MEDICARE_WORKING_AGED');

      // 15 employees: Medicare pays first.
      order = await coverageDetailService.upsert(
        ownPatPlan.toString(),
        { employerSizeBand: 'UNDER_20' },
        STAFF
      );
      expect(order.order!.positions[0].coverageId).toBe(spousePatPlan.toString());
    } finally {
      await prisma.patplan.update({
        where: { PatPlanNum: spousePatPlan },
        data: { Relationship: REL_CHILD },
      });
    }
  });

  it('requires an ESRD entitlement date when ESRD is recorded', async () => {
    await expect(
      coverageDetailService.upsert(
        ownPatPlan.toString(),
        { medicareEntitlementReason: 'ESRD', esrdEntitlementDate: null },
        STAFF
      )
    ).rejects.toThrow(/esrdEntitlementDate is required/);
  });

  it('rejects an unknown payer type', async () => {
    await expect(
      setPayerType(ownCarrier.toString(), 'MEDICARE_ADVANTAGE_MAYBE', STAFF)
    ).rejects.toThrow(/payerType must be one of/);
  });

  it('removes a coverage’s COB facts when the coverage is deleted', async () => {
    // No FK ties cob_coverage_detail to patplan (the app-native convention
    // here), so nothing in the database cleans it up. Left behind, a future
    // patplan reusing the number would inherit another patient's employer
    // size and Medicare entitlement reason, and the rule engine would read
    // them as fact.
    const temp = await makeCoverage({
      name: 'Temp Coverage',
      relationship: REL_SELF,
      ordinal: 3,
      effective: '2024-01-01',
    });

    await coverageDetailService.upsert(
      temp.patPlan.toString(),
      { coverageBasis: 'EMPLOYER_GROUP', employerSizeBand: '100_PLUS' },
      STAFF
    );
    expect(
      await prisma.cob_coverage_detail.count({ where: { patplan_num: temp.patPlan } })
    ).toBe(1);

    const { patientInsuranceService } = await import('../src/services/patient-insurance.service');
    await patientInsuranceService.deletePatientInsurance(
      patNum.toString(),
      temp.patPlan.toString()
    );

    expect(
      await prisma.cob_coverage_detail.count({ where: { patplan_num: temp.patPlan } })
    ).toBe(0);
  });

  // ── Injury relatedness comes from the claim ─────────────────────────────

  it("reads injury relatedness off the CLAIM, not the request body", async () => {
    // INJURY_RELATED is the FIRST rule in the sequence, so it overrides every
    // Medicare, Medicaid and plan-level rule below it. It must come from the
    // claim record, not from a caller-supplied boolean.
    await setPayerType(spouseCarrier.toString(), 'WORKERS_COMP', STAFF);
    await coverageDetailService.upsert(
      spousePatPlan.toString(),
      { coverageBasis: 'WORKERS_COMP' },
      STAFF
    );

    const makeClaim = async (fields: Record<string, unknown>) => {
      const claimNum = await getNextId('claim', 'ClaimNum');
      await prisma.claim.create({
        data: {
          ClaimNum: claimNum,
          PatNum: patNum,
          PlanNum: ownPlanNum,
          ClaimStatus: 'W',
          DateService: new Date('2026-03-01T00:00:00.000Z'),
          ...fields,
        },
      });
      return claimNum;
    };

    const plainClaim = await makeClaim({});
    const employmentClaim = await makeClaim({ EmployRelated: 1 });
    const autoClaim = await makeClaim({ AccidentRelated: 'A' });

    try {
      // Not injury related: the usual rules apply and the patient's own plan
      // is primary, with the comp policy behind it.
      const plain = await cobService.evaluateAndSave(patNum.toString(), {
        effectiveFrom: '2026-01-01',
        claimContext: { claimId: plainClaim.toString() },
        userNum: STAFF,
      });
      expect(plain.positions[0].coverageId).toBe(ownPatPlan.toString());
      expect(plain.positions[0].ruleCode).not.toBe('INJURY_RELATED');

      // Employment related: the comp policy pays first, decided by
      // INJURY_RELATED — and nothing in the request said so.
      const employment = await cobService.evaluateAndSave(patNum.toString(), {
        effectiveFrom: '2026-02-01',
        claimContext: { claimId: employmentClaim.toString() },
        userNum: STAFF,
      });
      expect(employment.positions[0].coverageId).toBe(spousePatPlan.toString());
      expect(employment.positions[0].ruleCode).toBe('INJURY_RELATED');

      // An auto accident against a workers' comp policy does NOT match: the
      // claim names a different injury type.
      const auto = await cobService.evaluateAndSave(patNum.toString(), {
        effectiveFrom: '2026-03-01',
        claimContext: { claimId: autoClaim.toString() },
        userNum: STAFF,
      });
      expect(auto.positions[0].ruleCode).not.toBe('INJURY_RELATED');
    } finally {
      await prisma.claim.deleteMany({
        where: { ClaimNum: { in: [plainClaim, employmentClaim, autoClaim] } },
      });
    }
  });

  it('derives the injury type from the claim encoding', async () => {
    const { deriveClaimInjuryContext } = await import('../src/services/cob/cob.service');
    const cases: Array<[Record<string, unknown>, boolean, string | null]> = [
      [{}, false, null],
      [{ EmployRelated: 1 }, true, 'WORKERS_COMP'],
      [{ AccidentRelated: 'E' }, true, 'WORKERS_COMP'],
      [{ AccidentRelated: 'A' }, true, 'AUTO_LIABILITY'],
      // 'O' is liability we cannot attribute to a payer type.
      [{ AccidentRelated: 'O' }, true, null],
      [{ AccidentRelated: '' }, false, null],
    ];

    for (const [fields, expectedRelated, expectedType] of cases) {
      const claimNum = await getNextId('claim', 'ClaimNum');
      await prisma.claim.create({
        data: { ClaimNum: claimNum, PatNum: patNum, ClaimStatus: 'W', ...fields },
      });
      try {
        const result = await deriveClaimInjuryContext(claimNum);
        expect(result.injuryRelated, JSON.stringify(fields)).toBe(expectedRelated);
        expect(result.injuryType, JSON.stringify(fields)).toBe(expectedType);
      } finally {
        await prisma.claim.delete({ where: { ClaimNum: claimNum } });
      }
    }
  });

  it('computes a claim-specific order WITHOUT persisting it', async () => {
    // The per-claim vs per-date tension: a comp claim and a flu shot on the
    // same date have different primaries, and one stored order cannot be
    // both. getOrderForClaim answers the claim-level question in memory so
    // the stored, patient-level order is never overwritten by one claim's
    // injury flag.
    await setPayerType(spouseCarrier.toString(), 'WORKERS_COMP', STAFF);
    await coverageDetailService.upsert(
      spousePatPlan.toString(),
      { coverageBasis: 'WORKERS_COMP' },
      STAFF
    );
    const stored = await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-01-01',
      userNum: STAFF,
    });
    expect(stored.positions[0].coverageId).toBe(ownPatPlan.toString());

    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patNum,
        PlanNum: ownPlanNum,
        ClaimStatus: 'W',
        DateService: new Date('2026-03-01T00:00:00.000Z'),
        EmployRelated: 1,
      },
    });

    try {
      const result = await cobService.getOrderForClaim(claimNum.toString());

      expect(result.injury).toEqual({ injuryRelated: true, injuryType: 'WORKERS_COMP' });
      // The claim's own order puts the comp policy first...
      expect(result.claimOrder.positions[0].coverageId).toBe(spousePatPlan.toString());
      expect(result.claimOrder.positions[0].ruleCode).toBe('INJURY_RELATED');
      // ...the stored patient-level order is untouched...
      expect(result.storedOrder!.positions[0].coverageId).toBe(ownPatPlan.toString());
      expect(result.differsFromStoredOrder).toBe(true);

      // ...and nothing was written: still the same version, no new rows.
      const after = await cobService.getCurrentOrder(patNum.toString());
      expect(after!.version).toBe(stored.version);
      expect(await prisma.cob_coverage_order.count({ where: { pat_num: patNum } })).toBe(
        (await cobService.getOrderHistory(patNum.toString())).length
      );
    } finally {
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    }
  });

  it('reports no difference for a claim with no injury flag', async () => {
    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-01-01',
      userNum: STAFF,
    });
    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patNum,
        ClaimStatus: 'W',
        DateService: new Date('2026-03-01T00:00:00.000Z'),
      },
    });
    try {
      const result = await cobService.getOrderForClaim(claimNum.toString());
      expect(result.injury.injuryRelated).toBe(false);
      expect(result.differsFromStoredOrder).toBe(false);
    } finally {
      await prisma.claim.delete({ where: { ClaimNum: claimNum } });
    }
  });

  it('treats a claim that does not exist as not injury related', async () => {
    const { deriveClaimInjuryContext } = await import('../src/services/cob/cob.service');
    const result = await deriveClaimInjuryContext(BigInt('999999999'));
    expect(result).toEqual({ injuryRelated: false, injuryType: null });
  });

  // ── Secondary estimate: every figure from the server ────────────────────

  describe('secondary estimate', () => {
    const CROWN = 'D2740';
    const ALLOWED = 900;
    const COVERAGE_PCT = 80;
    let feeSchedNum: bigint;

    beforeEach(async () => {
      // Give the spouse's plan a real PPO allowance and coverage table, which
      // is where the estimate must get its numbers from.
      feeSchedNum = await getNextId('feesched', 'FeeSchedNum');
      await prisma.feesched.create({
        data: { FeeSchedNum: feeSchedNum, Description: `COB Est ${feeSchedNum}` },
      });

      let proc = await prisma.procedurecode.findUnique({ where: { ProcCode: CROWN } });
      if (!proc) {
        const codeNum = await getNextId('procedurecode', 'CodeNum');
        proc = await prisma.procedurecode.create({
          data: { CodeNum: codeNum, ProcCode: CROWN, CoverageCategory: 'Major' },
        });
      }
      const feeNum = await getNextId('fee', 'FeeNum');
      await prisma.fee.create({
        data: { FeeNum: feeNum, FeeSched: feeSchedNum, CodeNum: proc.CodeNum!, Amount: ALLOWED },
      });

      await prisma.insplan.update({
        where: { PlanNum: spousePlanNum },
        data: { PlanType: 'p', FeeSched: feeSchedNum, AllowedFeeSched: feeSchedNum },
      });

      const meta: any = (await getPatientInsuranceMeta(spousePatPlan)) || {};
      await setPatientInsuranceMeta(spousePatPlan, {
        ...meta,
        coverageCategoryTable: [
          { category: 'Major', coverage: COVERAGE_PCT },
          { category: 'Restorative', coverage: COVERAGE_PCT },
        ],
      });
    });

    afterEach(async () => {
      await prisma.insplan
        .update({
          where: { PlanNum: spousePlanNum },
          data: { PlanType: '', FeeSched: null, AllowedFeeSched: null },
        })
        .catch(() => undefined);
      await prisma.fee.deleteMany({ where: { FeeSched: feeSchedNum } }).catch(() => undefined);
      await prisma.feesched
        .delete({ where: { FeeSchedNum: feeSchedNum } })
        .catch(() => undefined);
    });

    it("takes the allowance and benefit percentage from the PLAN, not the request", async () => {
      const result = await cobService.estimateSecondary(spousePatPlan.toString(), {
        procedureCode: CROWN,
        billedAmount: 1200,
        primaryPaid: 400,
        primaryPatientResponsibility: 500,
      });

      expect(result.inputs.allowedAmount).toBe(ALLOWED);
      expect(result.inputs.secondaryCoveragePercent).toBe(COVERAGE_PCT);
      // And it says where each number came from, so a quoted figure is traceable.
      expect(result.inputs.resolvedFrom.allowedAmount).toBe('ALLOWED_FEE_SCHEDULE');
      expect(result.inputs.resolvedFrom.secondaryCoveragePercent).toBe('PLAN_COVERAGE_TABLE');
      expect(result.inputs.resolvedFrom.secondaryDeductibleRemaining).toBe(
        'PLAN_DEDUCTIBLE_LEDGER'
      );
      // The figures the caller DID supply are marked as overrides.
      expect(result.inputs.resolvedFrom.primaryPaid).toBe('STAFF_OVERRIDE');
      expect(result.inputs.resolvedFrom.billedAmount).toBe('STAFF_OVERRIDE');
    });

    it('reads the primary payment off the primary REMITTANCE', async () => {
      const claimNum = await getNextId('claim', 'ClaimNum');
      await prisma.claim.create({
        data: {
          ClaimNum: claimNum,
          PatNum: patNum,
          PlanNum: ownPlanNum,
          InsSubNum: ownInsSub,
          ClaimStatus: 'R',
          DateService: new Date('2026-03-01T00:00:00.000Z'),
          DateReceived: new Date('2026-03-20T00:00:00.000Z'),
          ClaimFee: 1200,
        },
      });
      const cpNum = await getNextId('claimproc', 'ClaimProcNum');
      await prisma.claimproc.create({
        data: {
          ClaimProcNum: cpNum,
          ClaimNum: claimNum,
          PatNum: patNum,
          PlanNum: ownPlanNum,
          Status: 1,
          FeeBilled: 1200,
          InsPayAmt: 560,
          WriteOff: 200,
        },
      });

      try {
        const result = await cobService.estimateSecondary(spousePatPlan.toString(), {
          procedureCode: CROWN,
          primaryClaimId: claimNum.toString(),
        });

        // Billed 1200, write-off 200 -> allowed 1000, paid 560, so the patient
        // was left 440. None of those came from the caller.
        expect(result.inputs.primaryPaid).toBe(560);
        expect(result.inputs.primaryPatientResponsibility).toBe(440);
        expect(result.inputs.resolvedFrom.primaryPaid).toBe('PRIMARY_REMITTANCE');
        expect(result.inputs.resolvedFrom.primaryPatientResponsibility).toBe(
          'PRIMARY_REMITTANCE'
        );
        expect(result.estimate).not.toBeNull();
      } finally {
        await prisma.claimproc.delete({ where: { ClaimProcNum: cpNum } });
        await prisma.claim.delete({ where: { ClaimNum: claimNum } });
      }
    });

    it('warns instead of coordinating when the primary has not adjudicated', async () => {
      const claimNum = await getNextId('claim', 'ClaimNum');
      await prisma.claim.create({
        data: {
          ClaimNum: claimNum,
          PatNum: patNum,
          PlanNum: ownPlanNum,
          ClaimStatus: 'S', // sent, nothing back
          DateService: new Date('2026-03-01T00:00:00.000Z'),
        },
      });
      try {
        const result = await cobService.estimateSecondary(spousePatPlan.toString(), {
          procedureCode: CROWN,
          primaryClaimId: claimNum.toString(),
        });
        expect(result.warnings.join(' ')).toContain('no posted remittance yet');
      } finally {
        await prisma.claim.delete({ where: { ClaimNum: claimNum } });
      }
    });

    it('returns NO estimate rather than a confident $0 when the benefit is unknown', async () => {
      // The regression this pins: the coverage percent used to default to 0,
      // so a plan with no coverage table quoted the patient "your secondary
      // pays nothing" when in truth nobody knew what it pays.
      const meta: any = (await getPatientInsuranceMeta(spousePatPlan)) || {};
      await setPatientInsuranceMeta(spousePatPlan, { ...meta, coverageCategoryTable: [] });

      const result = await cobService.estimateSecondary(spousePatPlan.toString(), {
        billedAmount: 1200,
        primaryPaid: 400,
        primaryPatientResponsibility: 500,
      });

      expect(result.estimate).toBeNull();
      expect(result.inputs.secondaryCoveragePercent).toBeNull();
      expect(result.warnings.join(' ')).toContain('no procedureCode was supplied');
    });

    it('returns a RANGE when the plan COB method is UNKNOWN, a figure when known', async () => {
      const unknown = await cobService.estimateSecondary(spousePatPlan.toString(), {
        procedureCode: CROWN,
        billedAmount: 1200,
        primaryPaid: 400,
        primaryPatientResponsibility: 500,
      });
      expect(unknown.cobPaymentMethod).toBe('UNKNOWN');
      expect(unknown.estimate).toHaveProperty('minPayment');
      expect(unknown.estimate).toHaveProperty('maxPayment');

      await planMasterService.updateCobFields(
        spousePlanNum.toString(),
        { cobPaymentMethod: 'NON_DUPLICATION', cobInfoSource: 'PAYER_CONFIRMED' },
        STAFF
      );

      const known = await cobService.estimateSecondary(spousePatPlan.toString(), {
        procedureCode: CROWN,
        billedAmount: 1200,
        primaryPaid: 400,
        primaryPatientResponsibility: 500,
      });
      expect(known.cobPaymentMethod).toBe('NON_DUPLICATION');
      expect(known.estimate).toHaveProperty('estimatedPayment');
      expect(known.cobInfoSource).toBe('PAYER_CONFIRMED');
    });

    it('warns when the code is not on the plan fee schedule', async () => {
      const result = await cobService.estimateSecondary(spousePatPlan.toString(), {
        procedureCode: 'D9999',
        billedAmount: 1200,
        primaryPaid: 400,
        primaryPatientResponsibility: 500,
      });
      expect(result.warnings.join(' ')).toContain("not on this plan's fee schedule");
    });
  });

  // ── Audit trail ─────────────────────────────────────────────────────────

  it('writes an immutable audit row for every COB decision', async () => {
    // The spec requires audit records for suggestions, overrides, flags,
    // verifications, payer reports, plan changes and denials. They go to
    // securitylog, which is hash-chained and append-only.
    const since = new Date();

    await cobService.evaluateAndSave(patNum.toString(), {
      effectiveFrom: '2026-01-01',
      userNum: STAFF,
    });
    await cobService.recordPayerReportedCoverage(
      {
        patientId: patNum.toString(),
        coverageId: spousePatPlan.toString(),
        reportedSelfOrder: 1,
        reportedIsActive: true,
        source: 'PHONE',
      },
      STAFF
    );
    await cobService.overrideOrder(
      patNum.toString(),
      [spousePatPlan.toString(), ownPatPlan.toString()],
      'Payer confirmed by phone that they adjudicate in this order',
      STAFF
    );

    const logs = await prisma.securitylog.findMany({
      where: { PatNum: patNum, LogDateTime: { gte: since } },
      orderBy: { SecurityLogNum: 'asc' },
    });
    const permTypes = logs.map((l) => l.PermType);

    // 1060 suggested, 1061 overridden, 1062 flag raised, 1064 verified,
    // 1065 payer reported — see src/constants/audit-types.ts.
    expect(permTypes).toContain(1060);
    expect(permTypes).toContain(1061);
    expect(permTypes).toContain(1065);

    const suggestion = logs.find((l) => l.PermType === 1060)!;
    const text = JSON.parse(suggestion.LogText!).text as string;
    // The audit row records the DECISION, not just that something happened.
    expect(text).toContain('COB order v');
    expect(text).toContain('SUBSCRIBER_BEFORE_DEPENDENT');

    const override = logs.find((l) => l.PermType === 1061)!;
    expect(JSON.parse(override.LogText!).text).toContain('Payer confirmed by phone');

    // Every row is chained, which is what makes it tamper-evident.
    const hashes = await prisma.securityloghash.findMany({
      where: { SecurityLogNum: { in: logs.map((l) => l.SecurityLogNum) } },
    });
    expect(hashes.length).toBe(logs.length);
    expect(logs.every((l) => l.UserNum === STAFF)).toBe(true);
  });

  it('records a plan COB field change in the audit trail', async () => {
    const since = new Date();
    await planMasterService.updateCobFields(
      ownPlanNum.toString(),
      { coordinatesBenefits: false },
      STAFF,
      { changeNote: 'Plan document section 7 confirms no COB provision' }
    );

    const logs = await prisma.securitylog.findMany({
      where: { PermType: 1066, LogDateTime: { gte: since } },
    });
    const match = logs.find((l) =>
      String(JSON.parse(l.LogText!).text).includes(`Plan ${ownPlanNum} `)
    );
    expect(match).toBeTruthy();
    const text = JSON.parse(match!.LogText!).text as string;
    expect(text).toContain('coordinatesBenefits true -> false');
    expect(text).toContain('Plan document section 7');

    // Plan changes are not patient-scoped, so they carry no PatNum — which is
    // why the global teardown cannot clean them by patient. Remove them here.
    await prisma.securityloghash.deleteMany({
      where: { SecurityLogNum: { in: logs.map((l) => l.SecurityLogNum) } },
    });
    await prisma.securitylog.deleteMany({
      where: { SecurityLogNum: { in: logs.map((l) => l.SecurityLogNum) } },
    });
  });

  // ── Submittability with no COB history ──────────────────────────────────

  it('does not block a patient who has never been COB-evaluated', async () => {
    // Plenty of patients have one plan and no COB history. Refusing to bill
    // them until somebody clicks evaluate would regress every existing flow.
    const check = await cobService.checkSubmittable(patNum.toString(), '2026-03-01');
    expect(check.allowed).toBe(true);
    expect(check.orderId).toBeNull();
  });
});
