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
<<<<<<< HEAD
      .get('/api/vital-signs/patient/1')
=======
      .get('/api/vital-signs/patient/abc')
>>>>>>> 36ff5e2 (.)
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
<<<<<<< HEAD
      .get('/api/vital-signs/1')
=======
      .get('/api/vital-signs/abc')
>>>>>>> 36ff5e2 (.)
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
      .put('/api/vital-signs/abc')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete vital sign params', async () => {
    const res = await request(app)
      .delete('/api/vital-signs/abc')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  describe('GET /vital-signs/normal-ranges', () => {
    it('returns default adult ranges when query is empty', async () => {
      const res = await request(app)
        .get('/api/vital-signs/normal-ranges')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.normalRanges.bloodPressureSystolic).toEqual({
        min: 90,
        max: 120,
        unit: 'mmHg',
      });
      expect(res.body.data.normalRanges.bmi).toEqual({
        min: 18.5,
        max: 24.9,
        unit: 'kg/m²',
      });
    });

    it('returns pediatric ranges for age <= 12', async () => {
      const res = await request(app)
        .get('/api/vital-signs/normal-ranges?age=10')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data.normalRanges.bloodPressureSystolic.max).toBe(110);
      expect(res.body.data.normalRanges.bmi.max).toBe(22.0);
    });

    it('returns elderly ranges for age >= 65', async () => {
      const res = await request(app)
        .get('/api/vital-signs/normal-ranges?age=70')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data.normalRanges.bloodPressureSystolic.max).toBe(130);
      expect(res.body.data.normalRanges.respiratoryRate.max).toBe(24);
    });

    it('returns 400 bad request for invalid query parameters', async () => {
      const res = await request(app)
        .get('/api/vital-signs/normal-ranges?age=-5&gender=invalid')
        .set(authHeader);
      expect(res.status).toBe(400);
    });
  });
});
