import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Recurring Appointments', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all recurring appointments', async () => {
    const res = await request(app)
      .get('/api/recurring-appointments')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates recurring appointment id', async () => {
    const res = await request(app)
      .get('/api/recurring-appointments/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates preview payload', async () => {
    const res = await request(app)
      .post('/api/recurring-appointments/preview')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates create recurring appointment payload', async () => {
    const res = await request(app)
      .post('/api/recurring-appointments')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates create with resolution payload', async () => {
    const res = await request(app)
      .post('/api/recurring-appointments/with-resolution')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates generate params', async () => {
    const res = await request(app)
      .post('/api/recurring-appointments/invalid-id/generate')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update payload', async () => {
    const res = await request(app)
      .put('/api/recurring-appointments/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates linked appointments params', async () => {
    const res = await request(app)
      .get('/api/recurring-appointments/invalid-id/appointments')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates delete params', async () => {
    const res = await request(app)
      .delete('/api/recurring-appointments/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
