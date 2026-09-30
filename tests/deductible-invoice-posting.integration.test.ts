import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/config/db';
import { invoiceService } from '../src/services/invoice.service';
import { getPatientInsuranceMeta, setPatientInsuranceMeta } from '../src/utils/opendental-auth.util';
import { getNextId } from '../src/utils/opendental-ids.util';
import { normalizeDeductibleGrid } from '../src/services/deductible.service';

const BASIC_LIMIT = 300;

let patNum: bigint;
let provNum: bigint;
let carrierNum: bigint;
let planNum: bigint;
let insSubNum: bigint;
let patPlanNum: bigint;

const readMet = async (rowKey: string) => {
  const meta: any = await getPatientInsuranceMeta(patPlanNum);
  const row = (meta.deductiblesGrid ?? []).find((r: any) => r.typeKey === rowKey);
  return row ? Number(row.metAmount) || 0 : null;
};

const setMet = async (rowKey: string, met: number) => {
  const meta: any = await getPatientInsuranceMeta(patPlanNum);
  const rows = (meta.deductiblesGrid ?? []).map((r: any) =>
    r.typeKey === rowKey ? { ...r, metAmount: met, metDate: new Date().toISOString().slice(0, 10) } : r,
  );
  await setPatientInsuranceMeta(patPlanNum, { ...meta, deductiblesGrid: rows } as any);
};

const makeInvoice = async (
  label: string,
  lines: Array<{ fee: number; deductibleApplied: number; rowKey: string; insPortion: number }>,
  patNum: bigint,
) => {
  const statementNum = await getNextId('statement', 'StatementNum');
  await prisma.statement.create({
    data: {
      StatementNum: statementNum,
      PatNum: patNum,
      DateSent: new Date(),
      StatementType: 'draft',
      NoteBold: JSON.stringify({ status: 'draft', _test: label }),
    },
  });

  for (const line of lines) {
    const procNum = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: procNum,
        PatNum: patNum,
        ProvNum: provNum,
        ProcDate: new Date(),
        ProcFee: line.fee,
        ProcStatus: 2,
        StatementNum: statementNum,
        OldCode: 'D2391',
        BillingNote: JSON.stringify({
          deductibleApplied: line.deductibleApplied,
          deductibleRowKey: line.rowKey,
          insPortion: line.insPortion,
          secondaryInsPortion: 0,
          ptPortion: line.fee - line.insPortion,
        }),
      },
    });
  }
  return { statementNum };
};

describe('Deductible posting at invoice finalization', () => {
  beforeAll(async () => {
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: { PatNum: patNum, FName: 'Post', LName: `Deductible${patNum}`, Birthdate: new Date('1990-01-15') },
    });

    provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: provNum,
        Abbr: `DP${String(patNum).slice(-5)}`,
        LName: 'PostingDentist',
        FName: 'Dana',
        NationalProvID: '1234567895',
      },
    });

    carrierNum = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: 'Deductible Posting Carrier',
        ElectID: `DP${String(patNum).slice(-6)}${Math.floor(Math.random() * 1000)}`,
      },
    });

    planNum = await getNextId('insplan', 'PlanNum');
    await prisma.insplan.create({ data: { PlanNum: planNum, CarrierNum: carrierNum, PlanType: '' } });

    insSubNum = await getNextId('inssub', 'InsSubNum');
    await prisma.inssub.create({
      data: { InsSubNum: insSubNum, PlanNum: planNum, Subscriber: patNum, SubscriberID: `SUB${patNum}` },
    });

    patPlanNum = await getNextId('patplan', 'PatPlanNum');
    await prisma.patplan.create({
      data: { PatPlanNum: patPlanNum, PatNum: patNum, InsSubNum: insSubNum, Ordinal: 1, IsPending: 0, Relationship: 0 },
    });

    await setPatientInsuranceMeta(patPlanNum, {
      renewalMonth: 1,
      deductiblesGrid: normalizeDeductibleGrid([
        { type: 'Standard', standard: true, individual: 100, family: 0, metAmount: 0 },
        { type: 'Preventative', individual: 100, family: 0, metAmount: 0 },
        { type: 'Basic', individual: BASIC_LIMIT, family: 0, metAmount: 0 },
        { type: 'Major', individual: 500, family: 0, metAmount: 0 },
        { type: 'Orthodontics', individual: 400, family: 0, metAmount: 0 },
      ]),
    } as any);
  });

  afterAll(async () => {
    if (!patNum) return;
    await prisma.procedurelog.deleteMany({ where: { PatNum: patNum } });
    await prisma.statement.deleteMany({ where: { PatNum: patNum } });
    await prisma.patplan.deleteMany({ where: { PatNum: patNum } });
    await prisma.inssub.deleteMany({ where: { Subscriber: patNum } });
    await prisma.insplan.deleteMany({ where: { PlanNum: planNum } });
    await prisma.carrier.deleteMany({ where: { CarrierNum: carrierNum } });
    await prisma.provider.deleteMany({ where: { ProvNum: provNum } });
    await prisma.$executeRaw`DELETE FROM "famaging" WHERE "PatNum" = ${patNum}`;
    await prisma.patient.deleteMany({ where: { PatNum: patNum } });
  });

  beforeEach(async () => {
    await setMet('basic', 0);
    await setMet('preventative', 0);
  });

  describe('Deductible posting at invoice finalization', () => {
    it('posts the deductible for a line with no insurance portion', async () => {
      const { statementNum } = await makeInvoice('no-ins', [
        { fee: 136, deductibleApplied: 136, rowKey: 'basic', insPortion: 0 },
      ], patNum);

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');

      expect(await readMet('basic')).toBe(136);
    });

    it('posts a line that insurance covers too', async () => {
      const { statementNum } = await makeInvoice('has-ins', [
        { fee: 136, deductibleApplied: 50, rowKey: 'basic', insPortion: 68.8 },
      ], patNum);

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');

      expect(await readMet('basic')).toBe(50);
    });

    it('posts all lines on a mixed invoice', async () => {
      const { statementNum } = await makeInvoice('mixed', [
        { fee: 85, deductibleApplied: 40, rowKey: 'preventative', insPortion: 0 },
        { fee: 136, deductibleApplied: 50, rowKey: 'basic', insPortion: 68.8 },
      ], patNum);

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');

      expect(await readMet('preventative')).toBe(40);
      expect(await readMet('basic')).toBe(50);
    });

    it('releases the posting when the invoice is voided', async () => {
      const { statementNum } = await makeInvoice('void-me', [
        { fee: 136, deductibleApplied: 136, rowKey: 'basic', insPortion: 0 },
      ], patNum);

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');
      expect(await readMet('basic')).toBe(136);

      await invoiceService.voidInvoice(statementNum.toString(), 'test void', '1');
      expect(await readMet('basic')).toBe(0);
    });

    it('records the posted amounts and marker on the statement', async () => {
      const { statementNum } = await makeInvoice('marker', [
        { fee: 136, deductibleApplied: 136, rowKey: 'basic', insPortion: 0 },
      ], patNum);

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');

      const row = await prisma.statement.findUnique({ where: { StatementNum: statementNum } });
      const meta = JSON.parse(row!.NoteBold || '{}');
      expect(meta.status).toBe('pending');
      expect(meta.deductiblePostedAt).toBeTruthy();
      expect(meta.deductiblePostedByRow).toEqual({ basic: 136 });
    });

    it('never double-posts when finalize is retried', async () => {
      const { statementNum } = await makeInvoice('idempotent', [
        { fee: 136, deductibleApplied: 136, rowKey: 'basic', insPortion: 0 },
      ], patNum);

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');
      expect(await readMet('basic')).toBe(136);

      await expect(invoiceService.finalizeInvoice(statementNum.toString(), '1')).rejects.toThrow();
      expect(await readMet('basic')).toBe(136);
    });

    it('does not repost when recalculateInvoice runs after finalization', async () => {
      const { statementNum } = await makeInvoice('recalc', [
        { fee: 136, deductibleApplied: 136, rowKey: 'basic', insPortion: 0 },
      ], patNum);

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');
      expect(await readMet('basic')).toBe(136);

      await invoiceService.recalculateInvoice(statementNum.toString());
      await invoiceService.recalculateInvoice(statementNum.toString());

      expect(await readMet('basic')).toBe(136);
    });

    it('ignores patient-penalty lines when posting', async () => {
      const { statementNum } = await makeInvoice('penalty', [
        { fee: 50, deductibleApplied: 50, rowKey: 'basic', insPortion: 0 },
      ], patNum);

      await prisma.procedurelog.updateMany({
        where: { StatementNum: statementNum },
        data: { NoBillIns: 1 },
      });

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');

      expect(await readMet('basic')).toBe(0);
    });

    it('reverses only once when voided twice', async () => {
      const { statementNum } = await makeInvoice('void-twice', [
        { fee: 136, deductibleApplied: 136, rowKey: 'basic', insPortion: 0 },
      ], patNum);

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');
      expect(await readMet('basic')).toBe(136);

      await invoiceService.voidInvoice(statementNum.toString(), 'first', '1');
      expect(await readMet('basic')).toBe(0);

      await expect(invoiceService.voidInvoice(statementNum.toString(), 'second', '1')).rejects.toThrow();
      expect(await readMet('basic')).toBe(0);
    });
  });

  describe('Deductible deadlock regression: fully-deductible services accumulate', () => {
    beforeEach(async () => {
      await setMet('basic', 0);
    });

    it('walks $0 -> $136 -> $272 -> $300 and then splits into coinsurance', async () => {
      const steps: Array<{ expectedMet: number; expectedDeductible: number }> = [
        { expectedMet: 136, expectedDeductible: 136 },
        { expectedMet: 272, expectedDeductible: 136 },
        { expectedMet: 300, expectedDeductible: 28 }, // metAmount now hits 300 because finalizeInvoice posts it all
      ];

      for (const [index, step] of steps.entries()) {
        const remaining = BASIC_LIMIT - (index === 0 ? 0 : steps[index - 1].expectedMet);
        const { statementNum } = await makeInvoice(`deadlock-${index}`, [
          { fee: 136, deductibleApplied: step.expectedDeductible, rowKey: 'basic', insPortion: 136 - step.expectedDeductible },
        ], patNum);

        await invoiceService.finalizeInvoice(statementNum.toString(), '1');

        expect(await readMet('basic'), `after service ${index + 1}, remaining was ${remaining}`).toBe(step.expectedMet);
      }
    });

    it('caps metAmount at the deductible limit', async () => {
      await setMet('basic', 300);
      const { statementNum } = await makeInvoice('capped', [
        { fee: 136, deductibleApplied: 0, rowKey: 'basic', insPortion: 108.8 },
      ], patNum);

      await invoiceService.finalizeInvoice(statementNum.toString(), '1');

      expect(await readMet('basic')).toBe(300);
    });
  });
});
