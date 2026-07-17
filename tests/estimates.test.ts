import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createEstimateRecord, createPatientRecord } from './helpers/fixtures';

describe('Estimates', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all estimates', async () => {
    const res = await request(app)
      .get('/api/estimates')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('lists an estimate created in the DB', async () => {
    const token = uniqueToken('est');
    const patient = await createPatientRecord(token);
    await createEstimateRecord({
      patientId: patient.PatNum,
      token,
    });

    const res = await request(app)
      .get('/api/estimates')
      .set(authHeader);
    expect(res.status).toBe(200);
    const estimates = res.body?.data?.estimates ?? [];
    expect(
      estimates.some((estimate: any) => (estimate.description || '').includes(token))
    ).toBe(true);
  });

  it('validates estimate id', async () => {
    const res = await request(app)
      .get('/api/estimates/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create estimate payload', async () => {
    const res = await request(app)
      .post('/api/estimates')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update estimate payload', async () => {
    const res = await request(app)
      .patch('/api/estimates/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete estimate params', async () => {
    const res = await request(app)
      .delete('/api/estimates/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates convert estimate payload', async () => {
    const res = await request(app)
      .post('/api/estimates/invalid-id/convert')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });
});
