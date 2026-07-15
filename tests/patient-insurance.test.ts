import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord } from './helpers/fixtures';

describe('Patient Insurance Reordering', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('safely swaps ordinals (reorders) active insurances without conflict errors', async () => {
    const token = uniqueToken('reorder');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);

    // Create two carriers
    const carrierNum1 = BigInt(Date.now() - Math.floor(Math.random() * 1000000));
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum1,
        CarrierName: `Carrier-1-${alphanumericToken}`,
        ElectID: `EL1${alphanumericToken.substring(0, 3)}`,
      },
    });

    const carrierNum2 = BigInt(Date.now() - Math.floor(Math.random() * 1000000) - 5000);
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum2,
        CarrierName: `Carrier-2-${alphanumericToken}`,
        ElectID: `EL2${alphanumericToken.substring(0, 3)}`,
      },
    });

    // Add primary insurance
    const res1 = await request(app)
      .post(`/api/patients/${patient.PatNum}/insurance`)
      .set(authHeader)
      .send({
        insuranceType: 'primary',
        insuranceCompanyId: carrierNum1.toString(),
        relationshipToPatient: 'self',
        effectiveDate: new Date().toISOString(),
        policyNumber: `POL1${alphanumericToken.substring(0, 10)}`,
        subscriberName: `SubName`,
        subscriberDateOfBirth: new Date(1990, 0, 1).toISOString(),
      });
    expect(res1.status).toBe(201);
    const ins1 = res1.body.data.insurance;

    // Add secondary insurance
    const res2 = await request(app)
      .post(`/api/patients/${patient.PatNum}/insurance`)
      .set(authHeader)
      .send({
        insuranceType: 'secondary',
        insuranceCompanyId: carrierNum2.toString(),
        relationshipToPatient: 'self',
        effectiveDate: new Date().toISOString(),
        policyNumber: `POL2${alphanumericToken.substring(0, 10)}`,
        subscriberName: `SubName`,
        subscriberDateOfBirth: new Date(1990, 0, 1).toISOString(),
      });
    expect(res2.status).toBe(201);
    const ins2 = res2.body.data.insurance;

    // Verify initial database order (ins1 = Ordinal 1, ins2 = Ordinal 2)
    const dbPlan1 = await prisma.patplan.findUnique({ where: { PatPlanNum: BigInt(ins1._id || ins1.id) } });
    const dbPlan2 = await prisma.patplan.findUnique({ where: { PatPlanNum: BigInt(ins2._id || ins2.id) } });
    expect(dbPlan1?.Ordinal).toBe(1);
    expect(dbPlan2?.Ordinal).toBe(2);

    // Call the reorder endpoint to swap their positions (make ins2 primary, ins1 secondary)
    const reorderRes = await request(app)
      .post(`/api/patients/${patient.PatNum}/insurance/reorder`)
      .set(authHeader)
      .send({
        insuranceIds: [ins2._id || ins2.id, ins1._id || ins1.id],
      });

    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.success).toBe(true);

    // Verify updated database order
    const updatedPlan1 = await prisma.patplan.findUnique({ where: { PatPlanNum: BigInt(ins1._id || ins1.id) } });
    const updatedPlan2 = await prisma.patplan.findUnique({ where: { PatPlanNum: BigInt(ins2._id || ins2.id) } });
    expect(updatedPlan2?.Ordinal).toBe(1); // was 2, now 1
    expect(updatedPlan1?.Ordinal).toBe(2); // was 1, now 2

    // Clean up
    await prisma.patplan.deleteMany({ where: { PatNum: patient.PatNum } });
    await prisma.inssub.deleteMany({ where: { Subscriber: patient.PatNum } });
    const insPlans1 = await prisma.insplan.findMany({ where: { CarrierNum: carrierNum1 } });
    for (const plan of insPlans1) {
      await prisma.insplan.delete({ where: { PlanNum: plan.PlanNum } });
    }
    const insPlans2 = await prisma.insplan.findMany({ where: { CarrierNum: carrierNum2 } });
    for (const plan of insPlans2) {
      await prisma.insplan.delete({ where: { PlanNum: plan.PlanNum } });
    }
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum1 } });
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum2 } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });
});
