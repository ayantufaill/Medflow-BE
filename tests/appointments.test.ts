import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import {
  createAppointmentRecord,
  createPatientRecord,
  createProviderRecord,
} from './helpers/fixtures';

describe('Appointments', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all appointments', async () => {
    const res = await request(app)
      .get('/api/appointments')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('lists an appointment created in the DB', async () => {
    const token = uniqueToken('appt');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    const res = await request(app)
      .get(`/api/appointments?search=${encodeURIComponent(token)}`)
      .set(authHeader);
    expect(res.status).toBe(200);
    const items = res.body?.data?.appointments ?? [];
    expect(
      items.some((item: any) =>
        (item.notes || '').includes(token) || (item.chiefComplaint || '').includes(token)
      )
    ).toBe(true);
  });

  it('validates calendar query', async () => {
    const res = await request(app)
      .get('/api/appointments/calendar')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates appointment id', async () => {
    const res = await request(app)
      .get('/api/appointments/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates provider schedule params', async () => {
    const res = await request(app)
      .get('/api/appointments/providers/invalid-id/schedule')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates available slots params', async () => {
    const res = await request(app)
      .get('/api/appointments/providers/invalid-id/available-slots')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create appointment payload', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update appointment payload', async () => {
    const res = await request(app)
      .put('/api/appointments/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates cancel appointment payload', async () => {
    const res = await request(app)
      .post('/api/appointments/invalid-id/cancel')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates reschedule appointment payload', async () => {
    const res = await request(app)
      .post('/api/appointments/invalid-id/reschedule')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates check-in params', async () => {
    const res = await request(app)
      .post('/api/appointments/invalid-id/check-in')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates delete appointment params', async () => {
    const res = await request(app)
      .delete('/api/appointments/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
