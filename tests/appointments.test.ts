import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import {
  createAppointmentRecord,
  createPatientRecord,
  createProviderRecord,
  createRoomRecord,
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

  it('gets patient appointments with roomId', async () => {
    const token = uniqueToken('appt-room');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const room = await createRoomRecord(token);
    
    const AptNum = BigInt(Math.floor(1000000 + Math.random() * 9000000));
    await prisma.appointment.create({
      data: {
        AptNum,
        PatNum: patient.PatNum,
        ProvNum: provider.ProvNum,
        AptDateTime: new Date(),
        Pattern: '30',
        ProcDescript: `Complaint ${token}`,
        Note: `Note ${token}`,
        AptStatus: 0,
        Op: room.OperatoryNum,
      },
    });

    const res = await request(app)
      .get(`/api/patients/${patient.PatNum}/appointments`)
      .set(authHeader);
    expect(res.status).toBe(200);
    const items = res.body?.data?.appointments ?? [];
    expect(items.length).toBeGreaterThan(0);
    
    const createdAppt = items.find((item: any) => item._id === AptNum.toString());
    expect(createdAppt).toBeDefined();
    expect(createdAppt.roomId).toBe(room.OperatoryNum.toString());
    expect(createdAppt).toHaveProperty('createdAt');
    expect(createdAppt).toHaveProperty('updatedAt');
    expect(createdAppt).toHaveProperty('customFields');
    expect(createdAppt).toHaveProperty('tags');
    expect(createdAppt).toHaveProperty('procedures');
    expect(createdAppt).toHaveProperty('visitType');
  });

  it('fails to create an appointment without a roomId', async () => {
    const token = uniqueToken('appt-err');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);

    const res = await request(app)
      .post('/api/appointments')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        providerId: provider.ProvNum.toString(),
        appointmentDate: '2026-08-01',
        startTime: '09:00',
        endTime: '09:30',
        durationMinutes: 30,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Please select an operatory first');
  });

  it('successfully creates an appointment when roomId is provided', async () => {
    const token = uniqueToken('appt-ok');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const room = await createRoomRecord(token);

    const res = await request(app)
      .post('/api/appointments')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        providerId: provider.ProvNum.toString(),
        appointmentDate: '2026-08-01',
        startTime: '09:00',
        endTime: '09:30',
        durationMinutes: 30,
        roomId: room.OperatoryNum.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.appointment.roomId).toBe(room.OperatoryNum.toString());
  });
});
