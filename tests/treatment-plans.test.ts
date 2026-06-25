import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord } from './helpers/fixtures';

describe('Treatment Plans', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('validates status code and item status codes', async () => {
    const token = uniqueToken('tp-status');
    const patient = await createPatientRecord(token);

    // Invalid status code should return 400
    const failRes = await request(app)
      .post('/api/treatment-plans')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        title: 'Test Restorative Plan',
        status: 'INVALID_STATUS'
      });
    expect(failRes.status).toBe(400);

    // Valid status code should succeed (201)
    const successRes = await request(app)
      .post('/api/treatment-plans')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        title: 'Test Restorative Plan',
        status: 'P',
        items: [
          { procedureCode: 'D2750', fee: 850, status: 'A' }
        ]
      });
    expect(successRes.status).toBe(201);
    const createdPlan = successRes.body?.data?.treatmentPlan;
    expect(createdPlan).toBeDefined();

    // Clean up
    await prisma.treatplan.delete({
      where: { TreatPlanNum: BigInt(createdPlan._id) }
    });
    await prisma.patient.delete({
      where: { PatNum: patient.PatNum }
    });
  });

  it('supports reordering line items', async () => {
    const token = uniqueToken('tp-reorder');
    const patient = await createPatientRecord(token);

    const initialRes = await request(app)
      .post('/api/treatment-plans')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        title: 'Test Reorder Plan',
        status: 'D',
        items: [
          { procedureCode: 'A', fee: 100 },
          { procedureCode: 'B', fee: 200 }
        ]
      });
    expect(initialRes.status).toBe(201);
    const plan = initialRes.body?.data?.treatmentPlan;

    // Call reorder with reversed list
    const reorderRes = await request(app)
      .patch(`/api/treatment-plans/${plan._id}/reorder`)
      .set(authHeader)
      .send({
        items: [
          { procedureCode: 'B', fee: 200 },
          { procedureCode: 'A', fee: 100 }
        ]
      });
    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body?.data?.treatmentPlan?.items[0]?.procedureCode).toBe('B');

    // Clean up
    await prisma.treatplan.delete({ where: { TreatPlanNum: BigInt(plan._id) } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('provides print-preview layout details', async () => {
    const token = uniqueToken('tp-print');
    const patient = await createPatientRecord(token);

    const initialRes = await request(app)
      .post('/api/treatment-plans')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        title: 'Test Print Plan',
        status: 'P',
        items: [
          { procedureCode: 'D1110', fee: 80 }
        ]
      });
    const plan = initialRes.body?.data?.treatmentPlan;

    const printRes = await request(app)
      .get(`/api/treatment-plans/${plan._id}/print`)
      .set(authHeader);
    expect(printRes.status).toBe(200);
    expect(printRes.body?.data?.patientName).toContain(patient.FName);
    expect(printRes.body?.data?.items[0]?.procedureCode).toBe('D1110');

    // Clean up
    await prisma.treatplan.delete({ where: { TreatPlanNum: BigInt(plan._id) } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });
});
