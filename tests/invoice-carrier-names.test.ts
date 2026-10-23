/**
 * Carrier names in getInvoiceById.
 *
 * The estimators price line items from the patient's ACTIVE coverage, but
 * `statement.NoteBold.insuranceCompanyId` is only populated when the invoice was
 * created from an appointment that had a carrier explicitly attached. For an
 * invoice built any other way it is null — so a dialog that reads the carrier
 * name off the invoice shows a dash even though insurance plainly applied, and
 * the user sees only "Primary"/"Secondary" with no carrier.
 *
 * These tests pin that the invoice response carries the patient's real coverage
 * names, ordinal-ordered, because that is now what the display depends on.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { invoiceService } from '../src/services/invoice.service';
import { getNextId } from '../src/utils/opendental-ids.util';

let patNum: bigint;
let primCarrier: bigint;
let secCarrier: bigint;
const cleanup: Array<() => Promise<unknown>> = [];

describe('invoice carrier names (integration)', () => {
  beforeAll(async () => {
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: { PatNum: patNum, FName: 'Cn', LName: `Carrier${patNum}`, Birthdate: new Date('1988-06-06') },
    });
    // Order matters: patplan references inssub, and inssub references the
    // patient, so both must go before the patient row or the FK blocks teardown.
    cleanup.push(async () => {
      await prisma.procedurelog.deleteMany({ where: { PatNum: patNum } });
      await prisma.statement.deleteMany({ where: { PatNum: patNum } });
      await prisma.patplan.deleteMany({ where: { PatNum: patNum } });
      await prisma.inssub.deleteMany({ where: { Subscriber: patNum } });
      await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1', patNum);
      await prisma.patient.delete({ where: { PatNum: patNum } });
    });

    primCarrier = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: { CarrierNum: primCarrier, CarrierName: 'Delta Dental PPO', ElectID: `DP${String(patNum).slice(-6)}` },
    });
    cleanup.push(() => prisma.carrier.delete({ where: { CarrierNum: primCarrier } }));

    secCarrier = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: { CarrierNum: secCarrier, CarrierName: 'Cigna Secondary', ElectID: `CS${String(patNum).slice(-6)}` },
    });
    cleanup.push(() => prisma.carrier.delete({ where: { CarrierNum: secCarrier } }));

    // Ordinal 1 = primary, 2 = secondary, matching mapOrdinalToInsuranceType.
    for (const [ordinal, carrierNum] of [[1, primCarrier], [2, secCarrier]] as const) {
      const insSubNum = await getNextId('inssub', 'InsSubNum');
      await prisma.inssub.create({
        data: { InsSubNum: insSubNum, PlanNum: await planFor(carrierNum), Subscriber: patNum, SubscriberID: `SUB${patNum}-${ordinal}` },
      });
      await prisma.patplan.create({
        data: { PatPlanNum: await getNextId('patplan', 'PatPlanNum'), PatNum: patNum, InsSubNum: insSubNum, Ordinal: ordinal, IsPending: 0 },
      });
    }
  });

  afterAll(async () => {
    for (const fn of cleanup.reverse()) await fn().catch(() => undefined);
  });

  const planFor = async (carrierNum: bigint) => {
    const existing = await prisma.insplan.findFirst({ where: { CarrierNum: carrierNum } });
    if (existing) return existing.PlanNum;
    const planNum = await getNextId('insplan', 'PlanNum');
    await prisma.insplan.create({ data: { PlanNum: planNum, CarrierNum: carrierNum, PlanType: '' } });
    return planNum;
  };

  const createInvoiceWithSplits = async () =>
    invoiceService.createStandaloneInvoice(
      {
        patientId: patNum.toString(),
        // No insuranceCompanyId / secondaryInsuranceCompanyId on the statement
        // meta — this is the case that used to produce a blank carrier name.
        items: [
          {
            code: 'D2740',
            description: 'Crown',
            charge: 400,
            ptPortion: 100,
            insPortion: 180,
            primaryInsPortion: 180,
            secondaryInsPortion: 45.5,
            totalInsPortion: 225.5,
            balance: 400,
            completed: true,
          },
        ],
      },
      '1',
    );

  it('returns the real primary carrier name for the patient', async () => {
    const invoice = await createInvoiceWithSplits();
    const { invoice: data } = await invoiceService.getInvoiceById(invoice.id);
    const primary = data.coverages.find((c: any) => c.insuranceType === 'primary');
    expect(primary).toBeDefined();
    expect(primary.name).toBe('Delta Dental PPO');
  });

  it('returns the real secondary carrier name for the patient', async () => {
    const invoice = await createInvoiceWithSplits();
    const { invoice: data } = await invoiceService.getInvoiceById(invoice.id);
    const secondary = data.coverages.find((c: any) => c.insuranceType === 'secondary');
    expect(secondary).toBeDefined();
    expect(secondary.name).toBe('Cigna Secondary');
  });

  it('exposes a name even though the invoice meta recorded no carrier', async () => {
    const invoice = await createInvoiceWithSplits();
    const { invoice: data } = await invoiceService.getInvoiceById(invoice.id);
    // The pre-fix failure mode: nothing to read a name from.
    expect(data.insuranceCompany).toBeNull();
    // ...but the coverage list still resolves both names.
    expect(data.coverages.filter((c: any) => c.name).length).toBeGreaterThanOrEqual(2);
  });

  it('still reports a coherent line-item split for the per-coverage rows', async () => {
    const invoice = await createInvoiceWithSplits();
    const { items } = await invoiceService.getInvoiceById(invoice.id);
    const item = items[0];
    // The estimator re-prices the line now that the patient has real coverage,
    // so the exact figures are not ours to assert. What must hold is that the
    // two coverage portions the dialog renders add up to the combined portion —
    // otherwise the per-coverage rows would not reconcile.
    expect(item.primaryInsPortion).toBeGreaterThan(0);
    expect(item.secondaryInsPortion).toBeGreaterThan(0);
    expect(
      Number((item.primaryInsPortion + item.secondaryInsPortion).toFixed(2)),
    ).toBeCloseTo(Number(item.totalInsPortion.toFixed(2)), 2);
  });
});