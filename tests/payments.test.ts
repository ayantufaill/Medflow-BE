import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createPaymentRecord, createInvoiceStatement } from './helpers/fixtures';

describe('Payments', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });


  it('gets all payments', async () => {
    const res = await request(app)
      .get('/api/payments')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('lists a payment created in the DB', async () => {
    const token = uniqueToken('pay');
    const patient = await createPatientRecord(token);
    await createPaymentRecord({
      patientId: patient.PatNum,
      token,
    });

    const res = await request(app)
      .get('/api/payments?limit=1000')
      .set(authHeader);
    expect(res.status).toBe(200);
    const payments = res.body?.data?.payments ?? [];
    expect(
      payments.some((payment: any) => (payment.notes || '').includes(token))
    ).toBe(true);
  });

  it('validates payment id', async () => {
    const res = await request(app)
      .get('/api/payments/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create payment payload', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates apply payment payload', async () => {
    const res = await request(app)
      .post('/api/payments/invalid-id/apply')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('creates an Account Credit payment with $0 PayAmt and offsetting paysplits', async () => {
    const token = uniqueToken('acct_cred_pay');
    const patient = await createPatientRecord(token);
    const statement = await createInvoiceStatement({
      patientId: patient.PatNum,
      token,
    });

    const res = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        invoiceId: statement.StatementNum.toString(),
        patientId: patient.PatNum.toString(),
        amount: 50.0,
        paymentMethod: 'Account Credit',
        paymentDate: new Date().toISOString(),
        notes: 'Deduct from patient account credit',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.payment).toBeDefined();

    // Verify payment in DB has PayAmt = 0
    const createdPayNum = BigInt(res.body.data.payment._id);
    const dbPayment = await prisma.payment.findUnique({
      where: { PayNum: createdPayNum },
      include: { paysplit: true },
    });

    expect(dbPayment).toBeDefined();
    expect(dbPayment?.PayAmt).toBe(0);
    expect(dbPayment?.paysplit).toHaveLength(2);

    const deductionSplit = dbPayment?.paysplit.find((s) => s.UnearnedType === 1n);
    const applicationSplit = dbPayment?.paysplit.find((s) => s.UnearnedType === 0n || s.UnearnedType === null);

    expect(deductionSplit).toBeDefined();
    expect(deductionSplit?.SplitAmt).toBe(-50.0);

    expect(applicationSplit).toBeDefined();
    expect(applicationSplit?.SplitAmt).toBe(50.0);
  });
});
