import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createProviderRecord, createPatientRecord } from './helpers/fixtures';
import { prisma } from '../src/config/db';
import { setProviderMeta } from '../src/utils/opendental-auth.util';

describe('Provider Availability Refined', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('validates provider ID and query parameters', async () => {
    const res = await request(app)
      .get('/api/providers/invalid_id/availability')
      .set(authHeader);
    expect(res.status).toBe(400);

    const res2 = await request(app)
      .get('/api/providers/999999/availability')
      .set(authHeader);
    // Missing both date and weekOf should fail
    expect(res2.status).toBe(400);
  });

  it('returns available slots as time blocks { start, end, isBooked } for date query', async () => {
    const token = uniqueToken('prov-avail');
    const provider = await createProviderRecord(token);
    const providerId = provider.ProvNum.toString();

    const date = '2026-06-15'; // A Monday
    const res = await request(app)
      .get(`/api/providers/${providerId}/availability?date=${date}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // 09:00 - 17:00 (16 slots of 30 mins)
    expect(res.body.data.length).toBe(16);
    expect(res.body.data[0]).toEqual({
      start: '2026-06-15T09:00:00',
      end: '2026-06-15T09:30:00',
      isBooked: false,
    });
    expect(res.body.data[15]).toEqual({
      start: '2026-06-15T16:30:00',
      end: '2026-06-15T17:00:00',
      isBooked: false,
    });

    // Cleanup
    await prisma.provider.delete({ where: { ProvNum: provider.ProvNum } });
  });

  it('marks slots as isBooked: true when conflicting with existing appointments', async () => {
    const token = uniqueToken('prov-conflict');
    const provider = await createProviderRecord(token);
    const providerId = provider.ProvNum.toString();

    const patient = await createPatientRecord(token);
    const patientId = patient.PatNum;

    // Create appointment at 10:00 AM for 30 minutes
    const appointmentDate = new Date('2026-06-15T10:00:00');
    const appointment = await prisma.appointment.create({
      data: {
        AptNum: BigInt(Date.now() % 100000000),
        PatNum: patientId,
        ProvNum: provider.ProvNum,
        AptDateTime: appointmentDate,
        Pattern: '30',
        AptStatus: 1,
      },
    });

    const date = '2026-06-15';
    const res = await request(app)
      .get(`/api/providers/${providerId}/availability?date=${date}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(16);
    // Find the slot starting at 10:00
    const slot10 = res.body.data.find((slot: any) => slot.start === '2026-06-15T10:00:00');
    expect(slot10).toBeDefined();
    expect(slot10.isBooked).toBe(true);

    // Cleanup
    await prisma.appointment.delete({ where: { AptNum: appointment.AptNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
    await prisma.provider.delete({ where: { ProvNum: provider.ProvNum } });
  });

  it('returns slots for a week range using weekOf query', async () => {
    const token = uniqueToken('prov-week');
    const provider = await createProviderRecord(token);
    const providerId = provider.ProvNum.toString();

    // Monday June 15, 2026 to Sunday June 21, 2026
    const weekOf = '2026-06-15';
    const res = await request(app)
      .get(`/api/providers/${providerId}/availability?weekOf=${weekOf}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    // Returns slots for 7 days. Each day has 16 slots, so 7 * 16 = 112 slots.
    expect(res.body.data.length).toBe(112);
    expect(res.body.data[0].start.startsWith('2026-06-15T')).toBe(true);
    expect(res.body.data[111].start.startsWith('2026-06-21T')).toBe(true);

    // Cleanup
    await prisma.provider.delete({ where: { ProvNum: provider.ProvNum } });
  });
});
