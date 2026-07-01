import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createPaymentRecord } from './helpers/fixtures';

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
      .get('/api/payments')
      .set(authHeader);
    expect(res.status).toBe(200);
    const payments = res.body?.data?.payments ?? [];
    expect(
      payments.some((payment: any) => (payment.notes || '').includes(token))
    ).toBe(true);
  });

  it('validates payment id', async () => {
    const res = await request(app)
      .get('/api/payments/1')
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
      .post('/api/payments/1/apply')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });
});
