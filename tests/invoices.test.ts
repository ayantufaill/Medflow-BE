import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createInvoiceStatement, createPatientRecord } from './helpers/fixtures';

describe('Invoices', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all invoices', async () => {
    const res = await request(app)
      .get('/api/invoices')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('lists an invoice created in the DB', async () => {
    const token = uniqueToken('inv');
    const patient = await createPatientRecord(token);
    const statement = await createInvoiceStatement({
      patientId: patient.PatNum,
      token,
    });

    const res = await request(app)
      .get('/api/invoices?limit=1000')
      .set(authHeader);
    expect(res.status).toBe(200);
    const invoices = res.body?.data?.invoices ?? [];
    expect(invoices.some((inv: any) => inv.invoiceNumber === statement.ShortGUID)).toBe(true);
  });

  it('validates invoice id', async () => {
    const res = await request(app)
      .get('/api/invoices/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create invoice from appointment payload', async () => {
    const res = await request(app)
      .post('/api/invoices/from-appointment/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update invoice payload', async () => {
    const res = await request(app)
      .patch('/api/invoices/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete invoice params', async () => {
    const res = await request(app)
      .delete('/api/invoices/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates add invoice item payload', async () => {
    const res = await request(app)
      .post('/api/invoices/invalid-id/items')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update invoice item payload', async () => {
    const res = await request(app)
      .patch('/api/invoices/invalid-id/items/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete invoice item params', async () => {
    const res = await request(app)
      .delete('/api/invoices/invalid-id/items/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates recalculate invoice payload', async () => {
    const res = await request(app)
      .post('/api/invoices/invalid-id/recalculate')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('creates a standalone invoice successfully', async () => {
    const token = uniqueToken('standalone-inv');
    const patient = await createPatientRecord(token);
    
    const payload = {
      patientId: patient.PatNum.toString(),
      items: [
        {
          code: 'D0120',
          description: 'Periodic oral evaluation',
          date: new Date().toISOString(),
          site: 'Upper Right',
          provider: 'Dentist',
          writeoff: 10,
          ptPortion: 40,
          insPortion: 40,
          charge: 90,
          balance: 80,
          dbi: true,
          completed: true
        }
      ]
    };

    const res = await request(app)
      .post('/api/invoices')
      .set(authHeader)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.patientId).toBe(patient.PatNum.toString());
    expect(res.body.data.invoice.totalAmount).toBe(90);
    expect(res.body.data.invoice.writeoffAmount).toBe(10);
    expect(res.body.data.invoice.patientPortion).toBe(40);
    expect(res.body.data.invoice.balanceDue).toBe(80);
  });

  it('gets patient composite ledger successfully', async () => {
    const token = uniqueToken('composite-ledg');
    const patient = await createPatientRecord(token);

    const res = await request(app)
      .get(`/api/invoices/patient/${patient.PatNum.toString()}/composite`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('invoices');
    expect(res.body.data).toHaveProperty('adjustments');
    expect(res.body.data).toHaveProperty('payments');
    expect(res.body.data).toHaveProperty('claims');
  });
});
