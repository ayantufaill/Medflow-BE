import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { appointmentService } from '../src/services/appointment.service';
import { waitlistService } from '../src/services/waitlist.service';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Waitlist Auto-Notification Engine', () => {
  let testPatientId: bigint;
  let testProviderId: bigint;
  let testApptTypeId: bigint;
  let testWaitlistId: bigint;
  let testApptId: bigint;

  beforeAll(async () => {
    // 1. Create Test Provider
    testProviderId = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: testProviderId,
        Abbr: 'TESTPROV',
        FName: 'Dr. Test',
        LName: 'WaitlistDoctor',
        IsHidden: 0,
      },
    });

    // 2. Create Test Patient
    testPatientId = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: {
        PatNum: testPatientId,
        FName: 'TestDavid',
        LName: 'WaitlistPatient',
        Email: 'testdavid@example.com',
        WirelessPhone: '5551234567',
        TxtMsgOk: 1,
        PatStatus: 0,
      },
    });

    // 3. Create Test Appointment Type
    testApptTypeId = await getNextId('appointmenttype', 'AppointmentTypeNum');
    await prisma.appointmenttype.create({
      data: {
        AppointmentTypeNum: testApptTypeId,
        AppointmentTypeName: 'General Exam',
        IsHidden: 0,
      },
    });

    // 4. Create Schedule entry for Waitlist
    const schedNum = await getNextId('schedule', 'ScheduleNum');
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1); // Tomorrow
    targetDate.setHours(10, 0, 0, 0);

    const schedule = await prisma.schedule.create({
      data: {
        ScheduleNum: schedNum,
        SchedDate: targetDate,
        StartTime: new Date(`1970-01-01T10:00:00Z`),
        StopTime: new Date(`1970-01-01T11:00:00Z`),
        SchedType: 0,
        ProvNum: testProviderId,
        Status: 0,
      },
    });

    // 5. Create Waitlist Entry (AsapComm)
    testWaitlistId = await getNextId('asapcomm', 'AsapCommNum');
    await prisma.asapcomm.create({
      data: {
        AsapCommNum: testWaitlistId,
        PatNum: testPatientId,
        ScheduleNum: schedule.ScheduleNum,
        FKey: testApptTypeId,
        FKeyType: 2, // Urgent priority
        ResponseStatus: 0, // Active status
        DateTimeEntry: new Date(),
        DateTimeOrig: new Date(),
        Note: JSON.stringify({ notes: 'Wants 10 AM slot tomorrow' }),
      },
    });

    // 6. Create Appointment that will be cancelled
    testApptId = await getNextId('appointment', 'AptNum');
    await prisma.appointment.create({
      data: {
        AptNum: testApptId,
        PatNum: testPatientId,
        ProvNum: testProviderId,
        AppointmentTypeNum: testApptTypeId,
        AptDateTime: targetDate,
        Pattern: '30',
        Op: 1n,
        ClinicNum: 1n,
        AptStatus: 0, // Scheduled (0 = scheduled, 1 = completed in OpenDental)
      },
    });
  });

  afterAll(async () => {
    // Cleanup created records
    try {
      if (testApptId) await prisma.appointment.delete({ where: { AptNum: testApptId } }).catch(() => {});
      if (testWaitlistId) {
        const entry = await prisma.asapcomm.findUnique({ where: { AsapCommNum: testWaitlistId } });
        if (entry) {
          await prisma.asapcomm.delete({ where: { AsapCommNum: testWaitlistId } }).catch(() => {});
          if (entry.ScheduleNum) await prisma.schedule.delete({ where: { ScheduleNum: entry.ScheduleNum } }).catch(() => {});
        }
      }
      if (testApptTypeId) await prisma.appointmenttype.delete({ where: { AppointmentTypeNum: testApptTypeId } }).catch(() => {});
      if (testPatientId) await prisma.patient.delete({ where: { PatNum: testPatientId } }).catch(() => {});
      if (testProviderId) await prisma.provider.delete({ where: { ProvNum: testProviderId } }).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should auto-match and notify waitlisted patient when appointment is cancelled', async () => {
    // Execute direct matchAndNotifyForCancellation
    const appt = await prisma.appointment.findUnique({
      where: { AptNum: testApptId },
      include: { provider_appointment_ProvNumToprovider: true },
    });

    expect(appt).toBeDefined();

    const result = await waitlistService.matchAndNotifyForCancellation({
      appointmentId: testApptId.toString(),
      providerId: testProviderId.toString(),
      appointmentTypeId: testApptTypeId.toString(),
      appointmentDateTime: appt!.AptDateTime!,
      providerName: 'Dr. Test WaitlistDoctor',
    });

    expect(result.matched).toBe(true);
    expect(result.waitlistEntryId).toBe(testWaitlistId.toString());

    // Verify metadata was updated on AsapComm entry
    const updatedWaitlist = await prisma.asapcomm.findUnique({
      where: { AsapCommNum: testWaitlistId },
    });

    expect(updatedWaitlist).toBeDefined();
    const meta = JSON.parse(updatedWaitlist!.Note || '{}');
    expect(meta.lastMatchNotifiedAt).toBeDefined();
    expect(meta.lastMatchedAppointmentId).toBe(testApptId.toString());
  });

  it('should trigger waitlist auto-notification flow during cancelAppointment service call', async () => {
    // Cancel the appointment via appointmentService
    const cancelledApt = await appointmentService.cancelAppointment(
      testApptId.toString(),
      '1',
      'Patient requested cancellation'
    );

    expect(cancelledApt).toBeDefined();
    expect(cancelledApt.status).toBe('cancelled');
  });
});
