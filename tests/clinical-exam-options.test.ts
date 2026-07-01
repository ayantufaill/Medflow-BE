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
  runExamTests('teeth-structure');

  describe('GET /clinical-exams/history/:examType/patient/:patientId - history dates', () => {
    it('retrieves history dates chronologically for standard and preference based exams', async () => {
      const resStandard = await request(app)
        .get(`/api/clinical-exams/history/teeth-structure/patient/${testPatientId}`)
        .set(authHeader);

      expect(resStandard.status).toBe(200);
      expect(resStandard.body.success).toBe(true);
      expect(Array.isArray(resStandard.body.data.dates)).toBe(true);

      const resPref = await request(app)
        .get(`/api/clinical-exams/history/biomechanical/patient/${testPatientId}`)
        .set(authHeader);

      expect(resPref.status).toBe(200);
      expect(resPref.body.success).toBe(true);
      expect(Array.isArray(resPref.body.data.dates)).toBe(true);
    });

    it('returns validation error for invalid patientId or invalid examType', async () => {
      const resInvalidPat = await request(app)
        .get(`/api/clinical-exams/history/teeth-structure/patient/abc`)
        .set(authHeader);

      expect(resInvalidPat.status).toBe(400);

      const resInvalidType = await request(app)
        .get(`/api/clinical-exams/history/invalid-type/patient/${testPatientId}`)
        .set(authHeader);

      expect(resInvalidType.status).toBe(400);
    });
  });
});
