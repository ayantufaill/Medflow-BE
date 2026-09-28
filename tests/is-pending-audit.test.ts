import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord } from './helpers/fixtures';
import { patientInsuranceService } from '../src/services/patient-insurance.service';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Phase 1: IsPending Audit & Fix', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('treats NULL IsPending as active in patient insurance service queries', async () => {
    const token = uniqueToken('ispending-null');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);

    // Create a carrier and plan
    const carrierNum = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Carrier-${alphanumericToken}`,
        ElectID: `L${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`,
      },
    });

    const planNum = await getNextId('insplan', 'PlanNum');
    await prisma.insplan.create({
      data: {
        PlanNum: planNum,
        CarrierNum: carrierNum,
        PlanType: '',
      },
    });

    const subNum = await getNextId('inssub', 'InsSubNum');
    await prisma.inssub.create({
      data: {
        InsSubNum: subNum,
        PlanNum: planNum,
        Subscriber: patient.PatNum,
        SubscriberID: `SUB-${alphanumericToken}`,
      },
    });

    // Create a patplan with explicit NULL IsPending (simulating legacy data)
    const patPlanNum = await getNextId('patplan', 'PatPlanNum');
    await prisma.patplan.create({
      data: {
        PatPlanNum: patPlanNum,
        PatNum: patient.PatNum,
        InsSubNum: subNum,
        Ordinal: 1,
        Relationship: 0,
        IsPending: null,
      },
    });

    // Active insurances query (isActive = true) MUST include the NULL record
    const activeInsurances = await patientInsuranceService.getPatientInsurances(patient.PatNum.toString(), true);
    expect(activeInsurances.length).toBe(1);
    expect(activeInsurances[0].isActive).toBe(true);

    // Query with isActive = false MUST NOT include it
    const pendingInsurances = await patientInsuranceService.getPatientInsurances(patient.PatNum.toString(), false);
    expect(pendingInsurances.length).toBe(0);

    // Clean up
    await prisma.patplan.delete({ where: { PatPlanNum: patPlanNum } });
    await prisma.inssub.delete({ where: { InsSubNum: subNum } });
    await prisma.insplan.delete({ where: { PlanNum: planNum } });
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('correctly discriminates active (0) vs pending (1) insurance', async () => {
    const token = uniqueToken('ispending-flags');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);

    const carrierNum = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: `Carrier-Flag-${alphanumericToken}`,
        ElectID: `E${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`,
      },
    });

    const planNum = await getNextId('insplan', 'PlanNum');
    await prisma.insplan.create({
      data: {
        PlanNum: planNum,
        CarrierNum: carrierNum,
      },
    });

    const subNum1 = await getNextId('inssub', 'InsSubNum');
    await prisma.inssub.create({
      data: {
        InsSubNum: subNum1,
        PlanNum: planNum,
        Subscriber: patient.PatNum,
        SubscriberID: `SUB1-${alphanumericToken}`,
      },
    });

    const subNum2 = await getNextId('inssub', 'InsSubNum');
    await prisma.inssub.create({
      data: {
        InsSubNum: subNum2,
        PlanNum: planNum,
        Subscriber: patient.PatNum,
        SubscriberID: `SUB2-${alphanumericToken}`,
      },
    });

    // Active record (0)
    const patPlanNum1 = await getNextId('patplan', 'PatPlanNum');
    await prisma.patplan.create({
      data: {
        PatPlanNum: patPlanNum1,
        PatNum: patient.PatNum,
        InsSubNum: subNum1,
        Ordinal: 1,
        Relationship: 0,
        IsPending: 0,
      },
    });

    // Pending record (1)
    const patPlanNum2 = await getNextId('patplan', 'PatPlanNum');
    await prisma.patplan.create({
      data: {
        PatPlanNum: patPlanNum2,
        PatNum: patient.PatNum,
        InsSubNum: subNum2,
        Ordinal: 2,
        Relationship: 0,
        IsPending: 1,
      },
    });

    const activeList = await patientInsuranceService.getPatientInsurances(patient.PatNum.toString(), true);
    expect(activeList.length).toBe(1);
    expect(activeList[0]._id).toBe(patPlanNum1.toString());

    const pendingList = await patientInsuranceService.getPatientInsurances(patient.PatNum.toString(), false);
    expect(pendingList.length).toBe(1);
    expect(pendingList[0]._id).toBe(patPlanNum2.toString());

    // Clean up
    await prisma.patplan.deleteMany({ where: { PatPlanNum: { in: [patPlanNum1, patPlanNum2] } } });
    await prisma.inssub.deleteMany({ where: { InsSubNum: { in: [subNum1, subNum2] } } });
    await prisma.insplan.delete({ where: { PlanNum: planNum } });
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });
});
