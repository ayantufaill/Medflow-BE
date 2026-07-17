import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createAppointmentTypeRecord } from './helpers/fixtures';

describe('Appointment Types', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all appointment types', async () => {
    const res = await request(app)
      .get('/api/appointment-types')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('creates an appointment type and finds it in the list', async () => {
    const token = uniqueToken('appt-type');
    const created = await createAppointmentTypeRecord(token);
    const name = created.AppointmentTypeName;

    const listRes = await request(app)
      .get('/api/appointment-types?limit=100')
      .set(authHeader);
    expect(listRes.status).toBe(200);
    const items = listRes.body?.data?.appointmentTypes ?? [];
    expect(items.some((item: any) => item.name === name)).toBe(true);
  });

  it('validates appointment type id', async () => {
    const res = await request(app)
      .get('/api/appointment-types/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create appointment type payload', async () => {
    const res = await request(app)
      .post('/api/appointment-types')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update appointment type payload', async () => {
    const res = await request(app)
      .put('/api/appointment-types/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete appointment type params', async () => {
    const res = await request(app)
      .delete('/api/appointment-types/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
