import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createInvoiceStatement } from './helpers/fixtures';

const FEE = 200;
const INS = 150;
const PT = 50;

const seedLineItem = async (
  patientId: bigint,
  statementNum: bigint,
  billingNote: Record<string, unknown>,
) => {
  const procNum = BigInt(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
  return prisma.procedurelog.create({
    data: {
      ProcNum: procNum,
      PatNum: patientId,
      ProcDate: new Date(),
      ProcFee: FEE,
      UnitQty: 1,
      StatementNum: statementNum,
      ProcStatus: 2,
      OldCode: 'D0120',
      BillingNote: JSON.stringify(billingNote),
    },
  });
};

const readNote = async (procNum: bigint) =>
  JSON.parse((await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } }))?.BillingNote || '{}');

describe('Transfer outstanding (magic stick)', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('transfers outstanding insurance to the patient, then back to insurance', async () => {
    const token = uniqueToken('xfer-both');
    const patient = await createPatientRecord(token);
    const statement = await createInvoiceStatement({ patientId: patient.PatNum, token });
    const proc = await seedLineItem(patient.PatNum, statement.StatementNum, {
      insPortion: INS,
      ptPortion: PT,
      writeoff: 0,
    });

    // → patient: the 150 insurance estimate moves onto the patient.
    const toPatient = await request(app)
      .post(`/api/invoices/${statement.StatementNum}/items/${proc.ProcNum}/transfer-outstanding`)
      .set(authHeader)
      .send({});
    expect(toPatient.status).toBe(200);
    expect(toPatient.body?.data?.transferredAmount).toBeCloseTo(INS, 2);

    let note = await readNote(proc.ProcNum);
    expect(note.insPortion).toBe(0);
    expect(note.ptPortion).toBeCloseTo(PT + INS, 2);

    // → insurance: everything the patient still owes moves back.
    const toInsurance = await request(app)
      .post(
        `/api/invoices/${statement.StatementNum}/items/${proc.ProcNum}/transfer-outstanding-to-insurance`
      )
      .set(authHeader)
      .send({});
    expect(toInsurance.status).toBe(200);
    expect(toInsurance.body?.data?.transferredAmount).toBeCloseTo(PT + INS, 2);

    note = await readNote(proc.ProcNum);
    expect(note.ptPortion).toBe(0);
    // Everything now sits on the insurance side: the original 150 estimate plus
    // the 200 the patient was carrying.
    expect(note.insPortion).toBeCloseTo(PT + INS, 2);
  });

  it('caps the insurance transfer at what is still outstanding after payments', async () => {
    const token = uniqueToken('xfer-cap');
    const patient = await createPatientRecord(token);
    const statement = await createInvoiceStatement({ patientId: patient.PatNum, token });
    // 200 fee, 50 write-off, 100 already paid -> only 50 remains outstanding.
    const proc = await seedLineItem(patient.PatNum, statement.StatementNum, {
      insPortion: INS,
      ptPortion: PT,
      writeoff: 50,
      paidAmount: 100,
    });

    const res = await request(app)
      .post(
        `/api/invoices/${statement.StatementNum}/items/${proc.ProcNum}/transfer-outstanding-to-insurance`
      )
      .set(authHeader)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body?.data?.transferredAmount).toBeCloseTo(50, 2);

    const note = await readNote(proc.ProcNum);
    expect(note.ptPortion).toBe(0);
    expect(note.insPortion).toBeCloseTo(INS + 50, 2);
  });

  it('rejects the transfer when the patient owes nothing', async () => {
    const token = uniqueToken('xfer-none');
    const patient = await createPatientRecord(token);
    const statement = await createInvoiceStatement({ patientId: patient.PatNum, token });
    const proc = await seedLineItem(patient.PatNum, statement.StatementNum, {
      insPortion: INS,
      ptPortion: 0,
      writeoff: 0,
    });

    const res = await request(app)
      .post(
        `/api/invoices/${statement.StatementNum}/items/${proc.ProcNum}/transfer-outstanding-to-insurance`
      )
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body?.error?.message || res.body?.message).toMatch(/no outstanding patient balance/i);
  });

  it('rejects a transfer for an item that belongs to another invoice', async () => {
    const token = uniqueToken('xfer-wrong-inv');
    const patient = await createPatientRecord(token);
    const statementA = await createInvoiceStatement({ patientId: patient.PatNum, token });
    const statementB = await createInvoiceStatement({ patientId: patient.PatNum, token });
    const proc = await seedLineItem(patient.PatNum, statementA.StatementNum, {
      insPortion: INS,
      ptPortion: PT,
    });

    const res = await request(app)
      .post(
        `/api/invoices/${statementB.StatementNum}/items/${proc.ProcNum}/transfer-outstanding-to-insurance`
      )
      .set(authHeader)
      .send({});
    expect(res.status).toBe(404);
  });

  it('writes a net-zero audit record for each direction', async () => {
    const token = uniqueToken('xfer-audit');
    const patient = await createPatientRecord(token);
    const statement = await createInvoiceStatement({ patientId: patient.PatNum, token });
    const proc = await seedLineItem(patient.PatNum, statement.StatementNum, {
      insPortion: INS,
      ptPortion: PT,
    });

    await request(app)
      .post(`/api/invoices/${statement.StatementNum}/items/${proc.ProcNum}/transfer-outstanding`)
      .set(authHeader)
      .send({})
      .expect(200);
    await request(app)
      .post(
        `/api/invoices/${statement.StatementNum}/items/${proc.ProcNum}/transfer-outstanding-to-insurance`
      )
      .set(authHeader)
      .send({})
      .expect(200);

    const adjustments = await prisma.adjustment.findMany({
      where: { ProcNum: proc.ProcNum },
    });
    const transferNotes = adjustments.filter((a) => (a.AdjNote || '').includes('Income Transfer'));
    expect(transferNotes).toHaveLength(2);
    // Net-zero records: the ledger total must not move.
    expect(transferNotes.every((a) => Number(a.AdjAmt) === 0)).toBe(true);
    expect(transferNotes.some((a) => (a.AdjNote || '').includes('Insurance to Patient'))).toBe(true);
    expect(transferNotes.some((a) => (a.AdjNote || '').includes('Patient to Insurance'))).toBe(true);
  });
});
