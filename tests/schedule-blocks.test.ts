import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createProviderRecord, createRoomRecord } from './helpers/fixtures';

describe('Schedule Blocks Overlap Validation', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('allows creating a block slot in an empty timeframe, but blocks overlapping slots', async () => {
    const token = uniqueToken('block-overlap');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const room = await createRoomRecord(token);

    // Create an appointment on 2026-07-20 from 09:30 to 10:00 (duration = 30 mins)
    const AptNum = BigInt(Math.floor(1000000 + Math.random() * 9000000));
    await prisma.appointment.create({
      data: {
        AptNum,
        PatNum: patient.PatNum,
        ProvNum: provider.ProvNum,
        AptDateTime: new Date('2026-07-20T09:30:00.000Z'),
        Pattern: '30',
        ProcDescript: `Complaint ${token}`,
        Note: `Note ${token}`,
        AptStatus: 1, // Scheduled
        Op: room.OperatoryNum,
      },
    });

    // 1. Attempt to create a block slot that does not overlap (09:00 to 09:30)
    const successRes = await request(app)
      .post('/api/schedule-blocks')
      .set(authHeader)
      .send({
        roomId: room.OperatoryNum.toString(),
        date: '2026-07-20',
        startTime: '09:00',
        endTime: '09:30',
        notes: 'Pre-meeting block',
        color: '-16777216',
      });
    expect(successRes.status).toBe(201);

    // 2. Attempt to create a block slot that overlaps partially (09:45 to 10:15)
    const failPartialRes = await request(app)
      .post('/api/schedule-blocks')
      .set(authHeader)
      .send({
        roomId: room.OperatoryNum.toString(),
        date: '2026-07-20',
        startTime: '09:45',
        endTime: '10:15',
        notes: 'Overlapping block',
        color: '-16777216',
      });
    expect(failPartialRes.status).toBe(400);
    expect(failPartialRes.body.error?.message || failPartialRes.body.message).toContain('Cannot create block slot: Overlaps with an existing appointment');

    // 3. Attempt to create a block slot that completely envelops the appointment (09:15 to 10:15)
    const failEnvelopRes = await request(app)
      .post('/api/schedule-blocks')
      .set(authHeader)
      .send({
        roomId: room.OperatoryNum.toString(),
        date: '2026-07-20',
        startTime: '09:15',
        endTime: '10:15',
        notes: 'Enveloping block',
        color: '-16777216',
      });
    expect(failEnvelopRes.status).toBe(400);
    expect(failEnvelopRes.body.error?.message || failEnvelopRes.body.message).toContain('Cannot create block slot: Overlaps with an existing appointment');
  });
});
