/**
 * Coverage-book LIMITS INTEGRATION test — drives the real
 * `invoiceService.estimateInvoiceItems` / `createStandaloneInvoice` /
 * `recalculateInvoice` pricing loop and the treatment-plan enrichment against a
 * live patplan, for the not-covered / waiting / age / frequency / lifetime
 * / flat-plan-portion rules added in `coverage-limits.service.ts`.
 *
 * `coverage-limits.test.ts` proves the pure evaluators and `coverage-loop.unit
 * .test.ts` proves the loop against a mocked DB. Neither can catch a
 * `policyStart` that never reaches the context, a tally that pushes a blocked
 * line, or a `coverageBlockedReason` that is computed but dropped before it is
 * persisted to `BillingNote` / `PlanMeta.feeDetailsByItemId`. This file drives
 * the real persistence path end to end.
 *
 * Scenarios:
 *   1. not-covered        -> insPortion 0, reason set, patient owes charge
 *   2. waiting-period     -> blocked inside the window, priced once past it
 *   3. age                -> blocked over the limit
 *   4. frequency          -> second line of the same code in one request blocks
 *   5. lifetime / flat    -> flat pays the benefit, second line hits the cap
 *   6. persistence        -> reason lands on BillingNote and clears on recalc
 *   7. treatment plan     -> reason lands on PlanMeta.feeDetailsByItemId and
 *                            the returned item surfaces it
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/config/db';
import { invoiceService } from '../src/services/invoice.service';
import { treatmentPlanService } from '../src/services/treatment-plan.service';
import { getPatientInsuranceMeta, setPatientInsuranceMeta } from '../src/utils/opendental-auth.util';
import { getNextId } from '../src/utils/opendental-ids.util';
import { normalizeDeductibleGrid } from '../src/services/deductible.service';

let patNum: bigint;
let carrierNum: bigint;
let planNum: bigint;
let insSubNum: bigint;
let patPlanNum: bigint;
const cleanup: Array<() => Promise<unknown>> = [];

const CHARGE = 100;

/**
 * Point the plan at a coverage book / category table / deductible state and
 * (optionally) move the policy start. Waiting resolves through the same
 * category ladder the percentages use, so the category name must match the
 * code's CDT category.
 */
const configurePlan = async (opts: {
  coverageBookData?: any[];
  categoryTable?: any[];
  metAmount?: number;
  dateEffective?: Date;
}) => {
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
        metAmount: opts.metAmount ?? 2000, // default: fully met, so percent/flat is clean
        metDate: '',
      },
    ]),
    coverageBookData: opts.coverageBookData ?? [],
    coverageCategoryTable: opts.categoryTable ?? [
      { category: 'Preventative', coverage: 50 },
      { category: 'Diagnostic', coverage: 50 },
      { category: 'Restorative', coverage: 50 },
      { category: 'Basic', coverage: 50 },
      { category: 'Major', coverage: 50 },
    ],
  } as any);

  await prisma.inssub.update({
    where: { InsSubNum: insSubNum },
    data: { DateEffective: opts.dateEffective ?? new Date('2020-01-01') },
  });
};

const estimate = (items: Record<string, any>[]) =>
  invoiceService.estimateInvoiceItems(patNum.toString(), items as any);

describe('Coverage-book limits through the pricing loop', () => {
  beforeAll(async () => {
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: { PatNum: patNum, FName: 'Cov', LName: `Book${patNum}`, Birthdate: new Date('1990-01-15') },
    });
    cleanup.push(() => prisma.patient.delete({ where: { PatNum: patNum } }));

    const provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: provNum,
        Abbr: `CB${String(patNum).slice(-5)}`,
        LName: 'CoverageDentist',
        FName: 'Casey',
        NationalProvID: '1234567890',
      },
    });
    cleanup.push(() => prisma.provider.delete({ where: { ProvNum: provNum } }));

    carrierNum = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Coverage Carrier ${patNum}`,
        ElectID: `CB${String(patNum).slice(-6)}${Math.floor(Math.random() * 1000)}`,
      },
    });
    cleanup.push(() => prisma.carrier.delete({ where: { CarrierNum: carrierNum } }));

    planNum = await getNextId('insplan', 'PlanNum');
    await prisma.insplan.create({ data: { PlanNum: planNum, CarrierNum: carrierNum, PlanType: 'p' } });
    cleanup.push(() => prisma.insplan.delete({ where: { PlanNum: planNum } }));

    insSubNum = await getNextId('inssub', 'InsSubNum');
    await prisma.inssub.create({
      data: {
        InsSubNum: insSubNum,
        PlanNum: planNum,
        Subscriber: patNum,
        SubscriberID: `SUB${patNum}`,
        DateEffective: new Date('2020-01-01'),
      },
    });

    patPlanNum = await getNextId('patplan', 'PatPlanNum');
    await prisma.patplan.create({
      data: { PatPlanNum: patPlanNum, PatNum: patNum, InsSubNum: insSubNum, Ordinal: 1, IsPending: 0 },
    });
    // `cleanup` is reversed at teardown, so push in dependency order:
    // patplan before inssub, inssub before insplan.
    cleanup.push(() => prisma.inssub.delete({ where: { InsSubNum: insSubNum } }));
    cleanup.push(() => prisma.patplan.delete({ where: { PatPlanNum: patPlanNum } }));
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
    if (failures.length > 0) {
      throw new Error(`Teardown leaked rows (${failures.length}):\n${failures.join('\n')}`);
    }
  });

  beforeEach(async () => {
    await configurePlan({});
  });

  it('blocks a not-covered code, pays nothing and leaves the patient the charge', async () => {
    await configurePlan({ coverageBookData: [{ code: 'D1110', nc: true }] });

    const [item] = await estimate([{ code: 'D1110', charge: CHARGE, date: '2024-06-01' }]);

    expect(item.coverageBlockedReason).toBe('not-covered');
    expect(item.coveragePct).toBe(0);
    expect(item.insPortion).toBe(0);
    expect(item.deductibleApplied).toBe(0);
    // Patient owes the whole charge — there is no contracted discount here.
    expect(item.ptPortion).toBe(CHARGE);
  });

  it('blocks a line inside the waiting window and prices it once past', async () => {
    await configurePlan({
      // D2740 (Restorative) carries a 12-month waiting period.
      categoryTable: [{ category: 'Restorative', coverage: 50, waiting: 12 }],
      metAmount: 2000,
      dateEffective: new Date('2024-01-15'), // policy starts ~1 month before the service
    });

    const [inside] = await estimate([{ code: 'D2740', charge: CHARGE, date: '2024-02-01' }]);
    expect(inside.coverageBlockedReason).toBe('waiting-period');
    expect(inside.insPortion).toBe(0);

    // Move the policy start well past the window: the same line now prices.
    await configurePlan({
      categoryTable: [{ category: 'Restorative', coverage: 50, waiting: 12 }],
      metAmount: 2000,
      dateEffective: new Date('2020-01-01'),
    });
    const [past] = await estimate([{ code: 'D2740', charge: CHARGE, date: '2024-02-01' }]);
    expect(past.coverageBlockedReason).toBeFalsy();
    // 50% of the $100 charge, no deductible left.
    expect(past.insPortion).toBe(50);
  });

  it('applies a waiting period set on a coded item that also carries a coverage %', async () => {
    // The Add-Coverage dialog saves the waiting on a coded item next to its
    // coverage % (`{ code, label, coverage, waiting }`). Both must apply: the
    // coded percent prices the line and the waiting blocks it inside the window.
    const codedItemTable = [
      {
        category: 'Restorative',
        items: [{ code: 'D2740', label: 'D2740', coverage: 50, waiting: 6 }],
      },
    ];

    await configurePlan({
      categoryTable: codedItemTable,
      metAmount: 2000,
      dateEffective: new Date('2024-01-15'), // 6-month window ends ~2024-07-15
    });

    const [inside] = await estimate([{ code: 'D2740', charge: CHARGE, date: '2024-02-01' }]);
    expect(inside.coverageBlockedReason).toBe('waiting-period');
    expect(inside.insPortion).toBe(0);

    // Past the window the coded 50% still prices the line.
    await configurePlan({
      categoryTable: codedItemTable,
      metAmount: 2000,
      dateEffective: new Date('2020-01-01'),
    });
    const [past] = await estimate([{ code: 'D2740', charge: CHARGE, date: '2024-02-01' }]);
    expect(past.coverageBlockedReason).toBeFalsy();
    expect(past.insPortion).toBe(50);
  });

  it('blocks a patient who is over the coverage-book age limit', async () => {
    // Patient DOB 1990-01-15 -> ~34 on the service date, over an 18 limit.
    await configurePlan({ coverageBookData: [{ code: 'D1110', age: '18' }] });

    const [over] = await estimate([{ code: 'D1110', charge: CHARGE, date: '2024-06-01' }]);
    expect(over.coverageBlockedReason).toBe('age');
    expect(over.insPortion).toBe(0);

    // No limit configured -> the same line prices normally.
    await configurePlan({});
    const [ok] = await estimate([{ code: 'D1110', charge: CHARGE, date: '2024-06-01' }]);
    expect(ok.coverageBlockedReason).toBeFalsy();
    expect(ok.insPortion).toBe(50);
  });

  it('blocks the second same-code line of a frequency rule within one request', async () => {
    // 1 prophy per 12 months; both lines land on the same service date, so the
    // first consumes the slot and the second is blocked.
    await configurePlan({ coverageBookData: [{ code: 'D1110', deliveryPattern: '1/12 M' }] });

    const items = await estimate([
      { code: 'D1110', charge: CHARGE, date: '2024-06-01' },
      { code: 'D1110', charge: CHARGE, date: '2024-06-01' },
    ]);

    expect(items[0].coverageBlockedReason).toBeFalsy();
    expect(items[0].insPortion).toBe(50);
    expect(items[1].coverageBlockedReason).toBe('frequency');
    expect(items[1].insPortion).toBe(0);
    expect(items[1].ptPortion).toBe(CHARGE);
  });

  it('pays a flat benefit then blocks once the lifetime cap is reached', async () => {
    // Flat $50 benefit on D1110, lifetime cap $50. Line one pays the flat $50 and
    // records it; line two hits the cap.
    await configurePlan({
      coverageBookData: [{ code: 'D1110', flatPlanPortion: '50', lifetimeLimit: '50' }],
    });

    const items = await estimate([
      { code: 'D1110', charge: CHARGE, date: '2024-06-01' },
      { code: 'D1110', charge: CHARGE, date: '2024-06-01' },
    ]);

    expect(items[0].coverageBlockedReason).toBeFalsy();
    // Flat benefit: the plan pays the fixed $50, and the percent reads as 0.
    expect(items[0].coveragePct).toBe(0);
    expect(items[0].insPortion).toBe(50);

    expect(items[1].coverageBlockedReason).toBe('lifetime-limit');
    expect(items[1].insPortion).toBe(0);
  });

  it('persists the reason to BillingNote and clears it when the rule is removed', async () => {
    await configurePlan({ coverageBookData: [{ code: 'D1110', nc: true }] });

    const created: any = await invoiceService.createStandaloneInvoice(
      {
        patientId: patNum.toString(),
        items: [
          {
            code: 'D1110',
            description: 'Prophylaxis',
            charge: CHARGE,
            date: new Date('2024-06-01').toISOString(),
          },
        ],
      } as any,
      'coverage-persist'
    );
    const invoiceId = String(created.id);
    const StatementNum = BigInt(invoiceId);
    cleanup.push(() =>
      prisma.procedurelog.deleteMany({ where: { StatementNum } }).then(() =>
        prisma.statement.delete({ where: { StatementNum } })
      )
    );
    // createStandaloneInvoice runs agingService, which writes an @@ignore'd
    // `famaging` row that blocks the patient delete unless removed with raw SQL.
    cleanup.push(async () => {
      await prisma.$executeRawUnsafe(
        'DELETE FROM famaging WHERE "PatNum" = $1::bigint',
        patNum.toString()
      );
    });

    const readLine = async () => {
      const procs = await prisma.procedurelog.findMany({ where: { StatementNum } });
      return JSON.parse(procs[0].BillingNote || '{}');
    };

    // The reason is persisted alongside the zeroed estimate.
    let line = await readLine();
    expect(line.coverageBlockedReason).toBe('not-covered');
    expect(line.insPortion).toBe(0);
    expect(line.ptPortion).toBe(CHARGE);

    // Removing the rule and re-estimating clears the stale reason.
    await configurePlan({});
    await invoiceService.recalculateInvoice(invoiceId);
    line = await readLine();
    expect(line.coverageBlockedReason).toBeNull();
    expect(line.insPortion).toBe(50);
  });

  it('stores the block reason on the treatment-plan PlanMeta and returns it on the item', async () => {
    await configurePlan({ coverageBookData: [{ code: 'D1110', nc: true }] });

    const created: any = await treatmentPlanService.createTreatmentPlan({
      patientId: patNum.toString(),
      title: 'Blocked Prophy Plan',
      status: 'P',
      items: [{ procedureCode: 'D1110', description: 'Prophylaxis', fee: CHARGE, status: 'A' }],
    });
    cleanup.push(() => treatmentPlanService.deleteTreatmentPlan(created._id));

    const item = created.items[0];
    expect(item.id).toBeDefined();
    expect(item.coverageBlockedReason).toBe('not-covered');

    // The reason is persisted in the plan's Note metadata, keyed by item id.
    const noteRow = await prisma.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(created._id) },
    });
    const note = JSON.parse(noteRow?.Note || '{}');
    expect(note.feeDetailsByItemId?.[item.id]?.coverageBlockedReason).toBe('not-covered');

    // Removing the rule and re-saving clears the reason from the metadata.
    await configurePlan({});
    const updated: any = await treatmentPlanService.updateTreatmentPlan(created._id, {
      items: [{ ...item, status: 'A' }],
    });
    const after = updated.items.find((i: any) => i.id === item.id);
    expect(after.coverageBlockedReason).toBeFalsy();

    const noteRow2 = await prisma.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(created._id) },
    });
    const note2 = JSON.parse(noteRow2?.Note || '{}');
    expect(note2.feeDetailsByItemId?.[item.id]?.coverageBlockedReason).toBeFalsy();
  });
});
