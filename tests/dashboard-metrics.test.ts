import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Reports Dashboard APIs', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets dashboard metrics default parameters', async () => {
    const res = await request(app)
      .get('/api/reports/dashboard/metrics')
      .set(authHeader);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    
    const data = res.body.data;
    expect(data.total).toBeDefined();
    expect(data.dentist).toBeDefined();
    expect(data.hygienist).toBeDefined();
    expect(data.trends).toBeDefined();
    expect(data.patients).toBeDefined();
    expect(data.caseAcceptance).toBeDefined();
    expect(data.hygienePotential).toBeDefined();
  });

  it('gets dashboard metrics with parameters', async () => {
    const res = await request(app)
      .get('/api/reports/dashboard/metrics?range=Monthly&date=2026-05-22&providerId=All')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trends.labels.length).toBe(12);
  });

  it('gets default dashboard goals', async () => {
    const res = await request(app)
      .get('/api/reports/dashboard/goals')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dentistHourlyGoal).toBeDefined();
  });

  it('updates dashboard goals', async () => {
    const updatePayload = {
      dentistHourlyGoal: 250,
      hygienistHourlyGoal: 60,
      newPatientsGoal: 30,
    };

    const updateRes = await request(app)
      .put('/api/reports/dashboard/goals')
      .set(authHeader)
      .send(updatePayload);

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.dentistHourlyGoal).toBe(250);

    // Verify it was persisted by reading it back
    const getRes = await request(app)
      .get('/api/reports/dashboard/goals')
      .set(authHeader);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.dentistHourlyGoal).toBe(250);
    expect(getRes.body.data.hygienistHourlyGoal).toBe(60);
    expect(getRes.body.data.newPatientsGoal).toBe(30);
  });
});
