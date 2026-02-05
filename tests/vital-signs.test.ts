import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createVitalSignRecord } from './helpers/fixtures';

describe('Vital Signs', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all vital signs', async () => {
    const res = await request(app)
      .get('/api/vital-signs')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('lists a vital sign created in the DB', async () => {
    const token = uniqueToken('vitals');
    const patient = await createPatientRecord(token);
    await createVitalSignRecord({
      patientId: patient.PatNum,
      token,
    });

    const res = await request(app)
      .get('/api/vital-signs')
      .set(authHeader);
    expect(res.status).toBe(200);
    const items = res.body?.data?.vitalSigns ?? [];
    expect(items.some((item: any) => (item.notes || '').includes(token))).toBe(true);
  });

  it('validates patient vital signs params', async () => {
    const res = await request(app)
      .get('/api/vital-signs/patient/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates appointment vital signs params', async () => {
    const res = await request(app)
      .get('/api/vital-signs/appointment/1')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates provider vital signs params', async () => {
    const res = await request(app)
      .get('/api/vital-signs/provider/1')
      .set(authHeader);
    expect(res.status).toBe(404);
  });

  it('validates vital sign id', async () => {
    const res = await request(app)
      .get('/api/vital-signs/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create vital sign payload', async () => {
    const res = await request(app)
      .post('/api/vital-signs')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update vital sign payload', async () => {
    const res = await request(app)
      .put('/api/vital-signs/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete vital sign params', async () => {
    const res = await request(app)
      .delete('/api/vital-signs/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
