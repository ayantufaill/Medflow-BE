import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { appointmentService } from '../src/services/appointment.service';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import {
  createAppointmentRecord,
  createPatientRecord,
  createProviderRecord,
} from './helpers/fixtures';

describe('Appointment Status Rules: Checked Out and No Show', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  describe('Checked Out Rules', () => {
    it('blocks checking out an appointment before its start time (future appointment)', async () => {
      const token = uniqueToken('future-co');
      const patient = await createPatientRecord(token);
      const provider = await createProviderRecord(token);

      // Future appointment: scheduled 1 day from now
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const appt = await createAppointmentRecord({
        patientId: patient.PatNum,
        providerId: provider.ProvNum,
        token,
        date: futureDate,
      });

      // 1. Attempt status update via PUT
      const resUpdate = await request(app)
        .put(`/api/appointments/${appt.AptNum}`)
        .set(authHeader)
        .send({ status: 'checked_out_complete' });

      expect(resUpdate.status).toBe(400);
      const errMsg = resUpdate.body.error?.message || resUpdate.body.message || '';
      expect(errMsg).toMatch(/Cannot check out an appointment before its scheduled start time/i);

      // 2. Attempt via /check-out endpoint
      const resCheckout = await request(app)
        .post(`/api/appointments/${appt.AptNum}/check-out`)
        .set(authHeader)
        .send({});

      expect(resCheckout.status).toBe(400);
      const errCheckoutMsg = resCheckout.body.error?.message || resCheckout.body.message || '';
      expect(errCheckoutMsg).toMatch(/Cannot check out an appointment before its scheduled start time/i);
    });

    it('allows checking out an appointment on or after its start time', async () => {
      const token = uniqueToken('past-co');
      const patient = await createPatientRecord(token);
      const provider = await createProviderRecord(token);

      // Past appointment: started 30 minutes ago
      const pastDate = new Date(Date.now() - 30 * 60 * 1000);
      const appt = await createAppointmentRecord({
        patientId: patient.PatNum,
        providerId: provider.ProvNum,
        token,
        date: pastDate,
      });

      const resUpdate = await request(app)
        .put(`/api/appointments/${appt.AptNum}`)
        .set(authHeader)
        .send({ status: 'checked_out_complete' });

      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.data.appointment.status).toBe('checked_out_complete');
    });

    it('allows manually overriding an appointment in No Show status to Checked Out', async () => {
      const token = uniqueToken('noshow-override');
      const patient = await createPatientRecord(token);
      const provider = await createProviderRecord(token);

      // Past appointment: started 2 hours ago
      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const appt = await createAppointmentRecord({
        patientId: patient.PatNum,
        providerId: provider.ProvNum,
        token,
        date: pastDate,
      });

      // Put it in no_show status first
      await appointmentService.updateAppointment(
        appt.AptNum.toString(),
        { status: 'no_show' },
        '1'
      );

      // Now override to checked_out_complete
      const resOverride = await request(app)
        .put(`/api/appointments/${appt.AptNum}`)
        .set(authHeader)
        .send({ status: 'checked_out_complete' });

      expect(resOverride.status).toBe(200);
      expect(resOverride.body.data.appointment.status).toBe('checked_out_complete');
    });

    it('locks appointment once Checked Out — rejecting further status changes', async () => {
      const token = uniqueToken('lock-co');
      const patient = await createPatientRecord(token);
      const provider = await createProviderRecord(token);

      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      const appt = await createAppointmentRecord({
        patientId: patient.PatNum,
        providerId: provider.ProvNum,
        token,
        date: pastDate,
      });

      // Check it out
      const resCheckout = await request(app)
        .put(`/api/appointments/${appt.AptNum}`)
        .set(authHeader)
        .send({ status: 'checked_out_complete' });
      expect(resCheckout.status).toBe(200);

      // Attempt to change status to 'scheduled' or 'unconfirmed'
      const resChange = await request(app)
        .put(`/api/appointments/${appt.AptNum}`)
        .set(authHeader)
        .send({ status: 'scheduled' });

      expect(resChange.status).toBe(400);
      const errChangeMsg = resChange.body.error?.message || resChange.body.message || '';
      expect(errChangeMsg).toMatch(/already been checked out and its status is locked/i);
    });
  });

  describe('No Show Automatic Rules', () => {
    it('does not transition appointment within the 60-minute buffer after end time', async () => {
      const token = uniqueToken('buffer-ns');
      const patient = await createPatientRecord(token);
      const provider = await createProviderRecord(token);

      // Appointment duration = 30 min (default pattern)
      // Ended 30 minutes ago (within 60m buffer)
      // Start time = now - 60 minutes
      const startDateTime = new Date(Date.now() - 60 * 60 * 1000);
      const appt = await createAppointmentRecord({
        patientId: patient.PatNum,
        providerId: provider.ProvNum,
        token,
        date: startDateTime,
      });

      const result = await appointmentService.evaluateAutoNoShow(appt);
      expect(result).toBeNull();

      const fetched = await appointmentService.getAppointmentById(appt.AptNum.toString());
      expect(fetched.status).not.toBe('no_show');
    });

    it('automatically transitions scheduled appointment to No Show when past end time by > 60 minutes', async () => {
      const token = uniqueToken('auto-ns');
      const patient = await createPatientRecord(token);
      const provider = await createProviderRecord(token);

      // Appointment duration = 30 min
      // Ended 90 minutes ago (> 60m buffer)
      // Start time = now - 120 minutes
      const startDateTime = new Date(Date.now() - 120 * 60 * 1000);
      const appt = await createAppointmentRecord({
        patientId: patient.PatNum,
        providerId: provider.ProvNum,
        token,
        date: startDateTime,
      });

      const result = await appointmentService.evaluateAutoNoShow(appt);
      expect(result).toBe('no_show');

      const fetched = await appointmentService.getAppointmentById(appt.AptNum.toString());
      expect(fetched.status).toBe('no_show');
    });
  });
});
