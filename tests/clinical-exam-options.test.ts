import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Biomechanical, Functional, Airway, and Clinical Opinion Exams APIs', () => {
  let authHeader: { Authorization: string };
  let testPatientId: bigint;
  let testProviderId: bigint;
  let testAppointmentId: bigint;

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();

    // 1. Resolve or create a patient
    const patient = await prisma.patient.findFirst();
    if (patient) {
      testPatientId = patient.PatNum;
    } else {
      const nextId = await getNextId('patient', 'PatNum');
      const newPat = await prisma.patient.create({
        data: { PatNum: nextId, LName: 'Doe', FName: 'ExamTest' },
      });
      testPatientId = newPat.PatNum;
    }

    // 2. Resolve or create a provider
    const provider = await prisma.provider.findFirst();
    if (provider) {
      testProviderId = provider.ProvNum;
    } else {
      const nextId = await getNextId('provider', 'ProvNum');
      const newProv = await prisma.provider.create({
        data: { ProvNum: nextId, Abbr: 'EXPROV', LName: 'Prov', FName: 'Test' },
      });
      testProviderId = newProv.ProvNum;
    }

    // 3. Resolve or create an appointment
    const nextAptId = await getNextId('appointment', 'AptNum');
    const newApt = await prisma.appointment.create({
      data: {
        AptNum: nextAptId,
        PatNum: testPatientId,
        ProvNum: testProviderId,
        AptDateTime: new Date(),
        AptStatus: 1,
      },
    });
    testAppointmentId = newApt.AptNum;
  });

  const runExamTests = (examType: string) => {
    describe(`Clinical Exam Type: ${examType}`, () => {
      it('PUT /clinical-exams/:examType/:appointmentId - upserts clinical exam details', async () => {
        const res = await request(app)
          .put(`/api/clinical-exams/${examType}/${testAppointmentId}`)
          .set(authHeader)
          .send({
            patientId: testPatientId.toString(),
            providerId: testProviderId.toString(),
            examData: {
              findings: 'Mild wear facets observed',
              diagnosis: 'Localized structural abrasion',
              notes: 'Follow up in 6 months',
            },
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.exam.examType).toBe(examType);
        expect(res.body.data.exam.examData.findings).toBe('Mild wear facets observed');
      });

      it('GET /clinical-exams/:examType/:appointmentId - retrieves clinical exam details', async () => {
        const res = await request(app)
          .get(`/api/clinical-exams/${examType}/${testAppointmentId}`)
          .set(authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.exam.examType).toBe(examType);
        expect(res.body.data.exam.examData.findings).toBe('Mild wear facets observed');
      });

      it('POST /clinical-exams/:examType/:appointmentId/sign - signs/locks clinical exam details', async () => {
        const signRes = await request(app)
          .post(`/api/clinical-exams/${examType}/${testAppointmentId}/sign`)
          .set(authHeader);

        expect(signRes.status).toBe(200);
        expect(signRes.body.success).toBe(true);
        expect(signRes.body.data.exam.isSigned).toBe(true);

        // Edit attempts should fail after signing
        const editRes = await request(app)
          .put(`/api/clinical-exams/${examType}/${testAppointmentId}`)
          .set(authHeader)
          .send({
            patientId: testPatientId.toString(),
            providerId: testProviderId.toString(),
            examData: { findings: 'Trying to edit signed document' },
          });

        expect(editRes.status).toBe(403);
        expect(editRes.body.success).toBe(false);
      });
    });
  };

  // Test the expanded clinical types and opinions
  runExamTests('biomechanical');
  runExamTests('functional');
  runExamTests('dentofacial-opinion');
  runExamTests('periodontal-opinion');
});
