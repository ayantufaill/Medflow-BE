/**
 * Primary/secondary insurance portion WRITE-PATH agreement.
 *
 * Two code paths write a procedure's insurance split into `BillingNote`, and
 * they must agree on one convention: `insPortion` holds the PRIMARY portion and
 * `secondaryInsPortion` the secondary. The line-item reader then resolves the
 * primary as `meta.primaryInsPortion || meta.insPortion`.
 *
 * That reader shape is the trap. `payment.service` writes BOTH `insPortion` and
 * an explicit `primaryInsPortion`, while `updateInvoiceItem` used to write only
 * `insPortion`. So on a line that had been through an insurance payment, the
 * stale `primaryInsPortion` kept winning the read and any later edit to the
 * primary portion was silently discarded — the value was written and then
 * ignored on the very next read.
 *
 * These tests pin the agreement rather than the specific numbers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { invoiceService } from '../src/services/invoice.service';
import { getNextId } from '../src/utils/opendental-ids.util';

let patNum: bigint;
const cleanup: Array<() => Promise<unknown>> = [];

const readMeta = async (procNum: bigint) => {
  const row = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
  return JSON.parse(row?.BillingNote || '{}');
};

describe('insurance portion write paths agree', () => {
  beforeAll(async () => {
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: { PatNum: patNum, FName: 'Sp', LName: `Split${patNum}`, Birthdate: new Date('1993-04-04') },
    });
    cleanup.push(async () => {
      await prisma.procedurelog.deleteMany({ where: { PatNum: patNum } });
      await prisma.statement.deleteMany({ where: { PatNum: patNum } });
      await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1', patNum);
      await prisma.patient.delete({ where: { PatNum: patNum } });
    });
  });

  afterAll(async () => {
    for (const fn of cleanup.reverse()) await fn().catch(() => undefined);
  });

  const createSplitInvoice = async () => {
    const invoice = await invoiceService.createStandaloneInvoice(
      {
        patientId: patNum.toString(),
        items: [
          {
            code: 'D2740',
            description: 'Crown with primary and secondary',
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
    // createStandaloneInvoice returns the mapped statement, not its line items,
    // so read them back to get the ProcNum.
    const fetched = await invoiceService.getInvoiceById(invoice.id);
    const procNum = BigInt(fetched.items[0]._id);
    return { invoiceId: invoice.id, procNum };
  };

  it('stores insPortion as the primary and keeps the two portions separate', async () => {
    const { invoiceId, procNum } = await createSplitInvoice();
    const meta = await readMeta(procNum);

    // The combined figure must never be written into insPortion, or the
    // secondary gets counted twice by recalculateInvoice.
    expect(meta.insPortion).toBe(180);
    expect(meta.secondaryInsPortion).toBe(45.5);
    expect(meta.totalInsPortion).toBeCloseTo(225.5, 2);
  });

  it('surfaces the primary and secondary portions separately on the line item', async () => {
    const { invoiceId, procNum } = await createSplitInvoice();
    const item = await invoiceService.getInvoiceById(invoiceId);
    const row = item.items.find((i: any) => i._id === procNum.toString());

    expect(row.primaryInsPortion).toBe(180);
    expect(row.secondaryInsPortion).toBe(45.5);
    expect(row.totalInsPortion).toBeCloseTo(225.5, 2);
  });

  it('keeps primaryInsPortion in step when the primary portion is edited', async () => {
    // The regression: payment.service leaves an explicit primaryInsPortion on
    // any line it has paid. Editing the primary through updateInvoiceItem wrote
    // only insPortion, so the stale primaryInsPortion still won the read and the
    // edit vanished.
    const { invoiceId, procNum } = await createSplitInvoice();

    // Simulate the payment path having written an explicit primaryInsPortion.
    await prisma.procedurelog.update({
      where: { ProcNum: procNum },
      data: {
        BillingNote: JSON.stringify({
          ...(await readMeta(procNum)),
          primaryInsPortion: 180,
          secondaryInsPortion: 45.5,
        }),
      },
    });

    await invoiceService.updateInvoiceItem(
      invoiceId,
      procNum.toString(),
      {
        insPortion: 150,      // new primary
        secondaryInsPortion: 45.5,
        ptPortion: 100,
        writeoff: 74.5,
      },
      '1',
    );

    const meta = await readMeta(procNum);
    expect(meta.insPortion).toBe(150);
    // Both must agree, otherwise the reader keeps returning the old value.
    expect(meta.primaryInsPortion).toBe(150);

    // And the edit must actually survive a read-back.
    const item = await invoiceService.getInvoiceById(invoiceId);
    const row = item.items.find((i: any) => i._id === procNum.toString());
    expect(row.primaryInsPortion).toBe(150);
    expect(row.secondaryInsPortion).toBe(45.5);
  });

  it('marks the line manually adjusted so recalculate keeps the split', async () => {
    const { invoiceId, procNum } = await createSplitInvoice();
    await invoiceService.updateInvoiceItem(
      invoiceId,
      procNum.toString(),
      { insPortion: 150, secondaryInsPortion: 45.5, ptPortion: 100, writeoff: 74.5 },
      '1',
    );
    const meta = await readMeta(procNum);
    expect(meta.isManuallyAdjusted).toBe(true);
  });
});