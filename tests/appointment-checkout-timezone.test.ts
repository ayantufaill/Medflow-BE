import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import {
  createAppointmentRecord,
  createPatientRecord,
  createProviderRecord,
} from './helpers/fixtures';

// Regression test for the timezone bug: a clinic in a UTC+5 area books a
// 6:00 PM appointment. The appointment datetime is stored with its 18:00
// wall-clock in the UTC components (createAppointment's toDateTime does
// this). The checkout guard used to compare against that instant as-is,
// which is 5 hours ahead for a +5 area, so checking out right after 6 PM
// failed with "Cannot check out an appointment before its scheduled start
// time". The fix interprets the scheduled start in the clinic's timezone,
// so the same code path must work for any UTC offset.

// Overrides the process clock (Date only, leaving timers intact so
// Prisma/supertest keep working) and returns a restore function.
// Because JWT expiry is validated against the clock, authentication must
// happen while the same frozen time is active — so each scenario logs in
// inside its own frozen window.
const freezeSystemTime = (epochMs: number): (() => void) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(epochMs);
  return () => vi.useRealTimers();
};

describe('Appointment Checkout Timezone Handling', () => {
  let clinicNum: bigint;

  beforeAll(async () => {
    // Dedicated clinic whose TimeZone is set to a +5 area (Asia/Karachi).
    const clinicNumNext = await getNextId('clinic', 'ClinicNum');
    const clinic = await prisma.clinic.create({
      data: {
        ClinicNum: clinicNumNext,
        Description: 'Timezone Test Clinic +5',
        City: 'Karachi',
        State: 'Sindh',
        TimeZone: 'Asia/Karachi',
      },
    });
    clinicNum = clinic.ClinicNum;
  });

  afterAll(async () => {
    if (clinicNum) {
      await prisma.appointment.deleteMany({ where: { ClinicNum: clinicNum } });
      await prisma.clinic.deleteMany({ where: { ClinicNum: clinicNum } });
    }
  });

  const seedAppointment = async (token: string) => {
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    // 6:00 PM scheduled (stored as 18:00 UTC = 18:00 clinic-local wall clock)
    const appt = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
      date: new Date(Date.UTC(2030, 5, 17, 18, 0, 0)), // 2030-06-17 18:00 UTC
    });
    await prisma.appointment.update({
      where: { AptNum: appt.AptNum },
      data: { ClinicNum: clinicNum },
    });
    return appt;
  };

  it('allows checking out a 6:00 PM appointment right after 6:00 PM local in a +5 area', async () => {
    const token = uniqueToken('tz-pos');

    // Freeze "now" at 13:30 UTC = 18:30 in Asia/Karachi (+5)
    const restore = freezeSystemTime(Date.UTC(2030, 5, 17, 13, 30, 0));
    try {
      const authHeader = await getAdminAuthHeader();
      const appt = await seedAppointment(token);

      const resUpdate = await request(app)
        .put(`/api/appointments/${appt.AptNum}`)
        .set(authHeader)
        .send({ status: 'checked_out_complete' });
      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.data.appointment.status).toBe('checked_out_complete');
    } finally {
      restore();
    }
  });

  it('blocks checking out a 6:00 PM appointment at 5:00 PM local in a +5 area', async () => {
    const token = uniqueToken('tz-neg');
    const restore = freezeSystemTime(Date.UTC(2030, 5, 17, 12, 0, 0)); // 17:00 local
    try {
      const authHeader = await getAdminAuthHeader();
      const appt = await seedAppointment(token);

      const resBlocked = await request(app)
        .post(`/api/appointments/${appt.AptNum}/check-out`)
        .set(authHeader)
        .send({});
      expect(resBlocked.status).toBe(400);
      const errMsg = resBlocked.body.error?.message || resBlocked.body.message || '';
      expect(errMsg).toMatch(/Cannot check out an appointment before its scheduled start time/i);
    } finally {
      restore();
    }
  });

  it('allows checking out via /check-out right after start time in a +5 area', async () => {
    const token = uniqueToken('tz-endpoint');
    const restore = freezeSystemTime(Date.UTC(2030, 5, 17, 13, 45, 0)); // 18:45 local
    try {
      const authHeader = await getAdminAuthHeader();
      const appt = await seedAppointment(token);

      const resCheckout = await request(app)
        .post(`/api/appointments/${appt.AptNum}/check-out`)
        .set(authHeader)
        .send({});
      expect(resCheckout.status).toBe(200);
      expect(resCheckout.body.data.appointment.status).toBe('completed');
    } finally {
      restore();
    }
  });
});