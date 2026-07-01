import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Patient Membership Plans API', () => {
  let authHeader: { Authorization: string };
  let testPatientId: bigint;
  let createdMembershipId: string;

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();

    // Resolve or create a patient
    const patient = await prisma.patient.findFirst();
    if (patient) {
      testPatientId = patient.PatNum;
    } else {
      const nextId = await getNextId('patient', 'PatNum');
      const newPat = await prisma.patient.create({
        data: { PatNum: nextId, LName: 'Doe', FName: 'MemberTest' },
      });
      testPatientId = newPat.PatNum;
    }
  });

  it('POST /api/patients/:patientId/memberships - creates a patient membership', async () => {
    const res = await request(app)
      .post(`/api/patients/${testPatientId}/memberships`)
      .set(authHeader)
      .send({
        insurancePlan: 'Bright Beginning',
        groupName: '550.00',
        groupNumber: '550.00',
        autoRenewal: true,
        saveAsTemplate: false,
        coverageType: 'ppo',
        planFeeGuide: 'careington',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.insurancePlan).toBe('Bright Beginning');
    expect(res.body.data.groupName).toBe('550.00');
    createdMembershipId = res.body.data.id;
  });

  it('GET /api/patients/:patientId/memberships - retrieves patient memberships', async () => {
    const res = await request(app)
      .get(`/api/patients/${testPatientId}/memberships`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((m: any) => m.id === createdMembershipId)).toBe(true);
  });

  it('DELETE /api/patients/:patientId/memberships/:membershipId - deletes patient membership', async () => {
    const res = await request(app)
      .delete(`/api/patients/${testPatientId}/memberships/${createdMembershipId}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await request(app)
      .get(`/api/patients/${testPatientId}/memberships`)
      .set(authHeader);
    expect(checkRes.body.data.some((m: any) => m.id === createdMembershipId)).toBe(false);
  });
});
