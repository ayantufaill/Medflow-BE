/**
 * Late-fee INTEGRATION test — drives the real `invoiceService.applyLateFee`
 * against a live database.
 *
 * `late-fee.test.ts` proves the pure tier math. It cannot catch the things that
 * only exist once the charge is written: that the provenance keys survive
 * `recalculateInvoice` (which parses and re-serializes BillingNote right after
 * creation, so a whitelist rebuild there would silently erase them and break
 * every future duplicate check), that the fee lands as one batched invoice with
 * a line per source, or that a real second attempt is actually rejected.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { invoiceService } from '../src/services/invoice.service';
import { getNextId } from '../src/utils/opendental-ids.util';

let patNum: bigint;
const cleanup: Array<() => Promise<unknown>> = [];

/** Tear a test patient down. Deletion order matters: statements and procedures
 *  hold FKs to the patient, and famaging is @@ignore'd so it needs raw SQL. */
const destroyPatient = async (p: bigint) => {
  await prisma.procedurelog.deleteMany({ where: { PatNum: p } });
  await prisma.statement.deleteMany({ where: { PatNum: p } });
  await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1', p);
  await prisma.patient.delete({ where: { PatNum: p } });
};


/** Days in the past for a @db.Date column, normalised to midnight. */
const daysAgo = (days: number) => {
  const d = new Date(Date.now() - days * 86_400_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/** A normal, non-penalty invoice owed entirely by the patient. */
const createSourceInvoice = async (charge: number) => {
  const invoice = await invoiceService.createStandaloneInvoice(
    {
      patientId: patNum.toString(),
      notes: 'Late fee test source',
      items: [
        {
          code: 'D1110',
          description: 'Adult prophylaxis',
          charge,
          ptPortion: charge,
          insPortion: 0,
          balance: charge,
          completed: true,
        },
      ],
    },
    '1',
  );
  return invoice;
};

/** Backdate the statement so the invoice has been sitting for `days`. */
const backdate = async (statementNum: string, days: number) => {
  await prisma.statement.update({
    where: { StatementNum: BigInt(statementNum) },
    data: { DateSent: daysAgo(days) },
  });
};

/** The penalty lines carrying late-fee provenance for this patient. */
const provenanceRows = async () => {
  const rows = await prisma.procedurelog.findMany({
    where: { PatNum: patNum, BillingNote: { contains: '"lateFeeTier"' } },
  });
  return rows
    .map((r) => JSON.parse(r.BillingNote || '{}'))
    .filter((m) => m.lateFeeSourceStatement != null);
};

describe('applyLateFee (integration)', () => {
  let clinicNum: bigint;

  beforeAll(async () => {
    patNum = await getNextId('patient', 'PatNum');
    clinicNum = await getNextId('clinic', 'ClinicNum');

    await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: 'Test Clinic',
        features: {
          path: ['lateFee', 'enabled'],
          equals: true,
        },
      },
    });

    // Create patient and associate with clinic
    await prisma.patient.create({
      data: {
        PatNum: patNum,
        FName: 'Lf',
        LName: `LateFee${patNum}`,
        Birthdate: new Date('1990-01-15'),
        ClinicNum: clinicNum,
      },
    });
    cleanup.push(() => destroyPatient(patNum));

    const maxVersion = await prisma.lateFeePolicy.aggregate({
      where: { clinicId: clinicNum },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    const policy = await prisma.lateFeePolicy.create({
      data: {
        clinicId: clinicNum,
        version: nextVersion,
        isActive: true,
        enabled: true,
        termsText: 'Standard 30-day late fee policy',
        gracePeriodDays: 0,
        paymentTermsDays: 30,
        feeType: 'flat',
        patientFeeAmount: 2500, // $2,500.00 in dollars
        corporateFeePct: 0,
        capPct: 100,
        createdBy: BigInt(1),
      },
    });

    // Record patient acceptance
    await prisma.lateFeePolicyAcceptance.create({
      data: {
        policyId: policy.id,
        patientId: patNum,
        channel: 'portal_checkbox',
      },
    });
  });

  afterAll(async () => {
    for (const fn of cleanup.reverse()) {
      await fn().catch(() => undefined);
    }
  });

  it('charges a flat fee and records provenance that survives recalculation', async () => {
    const source = await createSourceInvoice(200);
    await backdate(source.id, 35);

    const result = await invoiceService.applyLateFee(
      {
        patientId: patNum.toString(),
        tier: 30,
        invoiceIds: [source.id],
        mode: 'flat',
        rate: 25,
        basis: 'patient',
      },
      '1',
    );

    expect(result.charged).toHaveLength(1);
    expect(result.totalFee).toBe(25);
    expect(result.rejected).toHaveLength(0);

    // The fee must land on its own invoice, not mutate the source invoice.
    expect(result.invoice.id).not.toBe(source.id);

    // createStandaloneInvoice calls recalculateInvoice before returning, so if
    // the provenance survived the write above it survives re-estimation.
    const rows = await provenanceRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].lateFeeSourceStatement).toBe(source.id);
    expect(rows[0].lateFeeTier).toBe(30);
    expect(rows[0].lateFeeBaseAmount).toBe(200);
  });

  it('rejects a second fee for the same invoice and tier', async () => {
    const source = await createSourceInvoice(300);
    await backdate(source.id, 40);

    const first = await invoiceService.applyLateFee(
      {
        patientId: patNum.toString(),
        tier: 30,
        invoiceIds: [source.id],
        mode: 'flat',
        rate: 10,
        basis: 'patient',
      },
      '1',
    );
    expect(first.charged).toHaveLength(1);

    // The whole call is rejected when nothing remains eligible.
    await expect(
      invoiceService.applyLateFee(
        {
          patientId: patNum.toString(),
          tier: 30,
          invoiceIds: [source.id],
          mode: 'flat',
          rate: 10,
          basis: 'patient',
        },
        '1',
      ),
    ).rejects.toThrow(/already been charged/i);
  });

  it('flags an already-charged invoice in eligibility and blocks re-selection', async () => {
    const eligibility = await invoiceService.getLateFeeEligibility(patNum.toString(), 30);
    const row = eligibility.invoices.find((r) => r.alreadyCharged);
    expect(row).toBeDefined();
    expect(row?.daysOutstanding).toBeGreaterThanOrEqual(30);
  });

  it('refuses to charge a tier the invoice has not reached', async () => {
    const source = await createSourceInvoice(150);
    await backdate(source.id, 35);

    // The invoice is in the 30-day band, so asking for the 90-day tier must fail
    // rather than quietly charging a 90-day fee against a 35-day debt.
    await expect(
      invoiceService.applyLateFee(
        {
          patientId: patNum.toString(),
          tier: 90,
          invoiceIds: [source.id],
          mode: 'flat',
          rate: 15,
          basis: 'patient',
        },
        '1',
      ),
    ).rejects.toThrow(/is in the 30-day tier, not 90/i);
  });

  it('never lists a 100-day invoice under the 30-day tier', async () => {
    const old = await createSourceInvoice(500);
    await backdate(old.id, 100);

    const tier30 = await invoiceService.getLateFeeEligibility(patNum.toString(), 30);
    expect(tier30.invoices.map((r) => r.id)).not.toContain(old.id);

    const tier90 = await invoiceService.getLateFeeEligibility(patNum.toString(), 90);
    const found = tier90.invoices.find((r) => r.id === old.id);
    expect(found).toBeDefined();
    expect(found?.daysOutstanding).toBeGreaterThanOrEqual(90);
  });

  it('batches several invoices onto one statement, one line each', async () => {
    const a = await createSourceInvoice(100);
    const b = await createSourceInvoice(200);
    await backdate(a.id, 45);
    await backdate(b.id, 50);

    const result = await invoiceService.applyLateFee(
      {
        patientId: patNum.toString(),
        tier: 30,
        invoiceIds: [a.id, b.id],
        mode: 'percentage',
        rate: 10,
        basis: 'patient',
      },
      '1',
    );

    expect(result.charged).toHaveLength(2);
    // 10% of 100 + 10% of 200.
    expect(result.totalFee).toBe(30);

    const feeItems = await prisma.procedurelog.findMany({
      where: { StatementNum: BigInt(result.invoice.id) },
    });
    expect(feeItems).toHaveLength(2);

    const rows = await provenanceRows();
    const sources = rows.map((r) => r.lateFeeSourceStatement);
    expect(sources).toContain(a.id);
    expect(sources).toContain(b.id);
  });

  it('does not charge an invoice that has never been sent', async () => {
    const fresh = await createSourceInvoice(120);
    // DateSent left as-is, i.e. today, so no clock has run.

    const result = await invoiceService.getLateFeeEligibility(patNum.toString(), null);
    expect(result.invoices.map((r) => r.id)).not.toContain(fresh.id);
  });

  it('rejects an invoice belonging to another patient', async () => {
    const otherPat = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: {
        PatNum: otherPat,
        FName: 'Other',
        LName: `Owner${otherPat}`,
        Birthdate: new Date('1991-02-02'),
      },
    });

    const otherInvoice = await invoiceService.createStandaloneInvoice(
      {
        patientId: otherPat.toString(),
        items: [
          {
            code: 'D1110',
            description: 'Other patient',
            charge: 90,
            ptPortion: 90,
            insPortion: 0,
            balance: 90,
            completed: true,
          },
        ],
      },
      '1',
    );
    await backdate(otherInvoice.id, 40);

    await expect(
      invoiceService.applyLateFee(
        {
          patientId: patNum.toString(),
          tier: 30,
          invoiceIds: [otherInvoice.id],
          mode: 'flat',
          rate: 10,
          basis: 'patient',
        },
        '1',
      ),
    ).rejects.toThrow(/does not belong/i);

    await destroyPatient(otherPat);
  });
});
describe('tier default rates (integration)', () => {
  let pat2: bigint;
  let clinicNum2: bigint;
  const cleanup2: Array<() => Promise<unknown>> = [];

  beforeAll(async () => {
    pat2 = await getNextId('patient', 'PatNum');
    clinicNum2 = await getNextId('clinic', 'ClinicNum');

    await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum2,
        Description: 'Test Clinic 2',
        features: {
          path: ['lateFee', 'enabled'],
          equals: true,
        },
      },
    });

    await prisma.patient.create({
      data: { PatNum: pat2, FName: 'Df', LName: `Default${pat2}`, Birthdate: new Date('1992-03-03'), ClinicNum: clinicNum2 },
    });
    cleanup2.push(() => destroyPatient(pat2));

    // Create active late fee policy
    const maxVersion = await prisma.lateFeePolicy.aggregate({
      where: { clinicId: clinicNum2 },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    const policy = await prisma.lateFeePolicy.create({
      data: {
        clinicId: clinicNum2,
        version: nextVersion,
        isActive: true,
        enabled: true,
        termsText: 'Standard 30-day late fee policy',
        gracePeriodDays: 0,
        paymentTermsDays: 30,
        feeType: 'flat',
        patientFeeAmount: 2500,
        corporateFeePct: 0,
        capPct: 100,
        createdBy: BigInt(1),
      },
    });

    // Record patient acceptance
    await prisma.lateFeePolicyAcceptance.create({
      data: {
        policyId: policy.id,
        patientId: pat2,
        channel: 'portal_checkbox',
      },
    });
  });

  afterAll(async () => {
    for (const fn of cleanup2.reverse()) await fn().catch(() => undefined);
  });

  const agedFor = async (charge: number, days: number) => {
    const inv = await invoiceService.createStandaloneInvoice(
      {
        patientId: pat2.toString(),
        items: [{ code: 'D1110', description: 'Default rate test', charge, ptPortion: charge, insPortion: 0, balance: charge, completed: true }],
      },
      '1',
    );
    const sent = new Date(Date.now() - days * 86_400_000);
    await prisma.statement.update({
      where: { StatementNum: BigInt(inv.id) },
      data: { DateSent: new Date(Date.UTC(sent.getUTCFullYear(), sent.getUTCMonth(), sent.getUTCDate())) },
    });
    return inv.id;
  };

  it.each([
    [30, 35, 50],
    [60, 70, 100],
    [90, 100, 150],
  ])('charges %i days at the fixed amount with no rate supplied', async (tier, days, expected) => {
    const id = await agedFor(400, days);
    const result = await invoiceService.applyLateFee(
      {
        patientId: pat2.toString(),
        tier,
        invoiceIds: [id],
        basis: 'patient',
      },
      '1',
    );
    expect(result.charged).toHaveLength(1);
    expect(result.totalFee).toBe(expected);
  });

  it('exposes the tier default on eligibility so the dialog cannot drift', async () => {
    const eligibility = await invoiceService.getLateFeeEligibility(pat2.toString(), 60);
    expect(eligibility.defaultRate).toBe(100);
  });

  it('still honours an explicitly supplied rate', async () => {
    const id = await agedFor(400, 33);
    const result = await invoiceService.applyLateFee(
      {
        patientId: pat2.toString(),
        tier: 30,
        invoiceIds: [id],
        rate: 12,
        basis: 'patient',
      },
      '1',
    );
    expect(result.totalFee).toBe(12);
  });

  it('refuses an un-tiered adjustment that supplies no rate', async () => {
    const id = await agedFor(400, 45);
    await expect(
      invoiceService.applyLateFee(
        { patientId: pat2.toString(), invoiceIds: [id], basis: 'patient' },
        '1',
      ),
    ).rejects.toThrow(/rate is required/i);
  });
});
