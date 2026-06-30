import { describe, it, expect } from 'vitest';
import { prisma } from '../../src/config/db';
import { treatmentPlanService } from '../../src/services/treatment-plan.service';
import { uniqueToken } from '../helpers/unique';
import { createPatientRecord } from '../helpers/fixtures';

describe('TreatmentPlanService', () => {
  it('should create a treatment plan correctly', async () => {
    const token = uniqueToken('tps-create');
    const patient = await createPatientRecord(token);
    
    const planData = {
      patientId: patient.PatNum.toString(),
      title: 'Test Create Plan',
      status: 'Proposed',
      items: [{ procedureCode: 'D1110', fee: 100, status: 'Proposed' }]
    };

    const plan = await treatmentPlanService.createTreatmentPlan(planData);
    
    expect(plan).toBeDefined();
    expect(plan.title).toBe(planData.title);
    expect(plan.status).toBe(planData.status);
    expect(plan.items).toHaveLength(1);
    
    // cleanup
    await prisma.treatplan.delete({ where: { TreatPlanNum: BigInt(plan._id) } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('should update a treatment plan and status transitions', async () => {
    const token = uniqueToken('tps-update');
    const patient = await createPatientRecord(token);
    
    const planData = {
      patientId: patient.PatNum.toString(),
      title: 'Test Update Plan',
      status: 'Proposed',
      items: [{ procedureCode: 'D1110', fee: 100, status: 'Proposed' }]
    };

    const plan = await treatmentPlanService.createTreatmentPlan(planData);
    
    // Transition status to Accepted
    const updatedPlan = await treatmentPlanService.updateTreatmentPlan(plan._id, {
      title: 'Test Update Plan Updated',
      status: 'Accepted'
    });
    
    expect(updatedPlan.title).toBe('Test Update Plan Updated');
    expect(updatedPlan.status).toBe('Accepted');
    
    // cleanup
    await prisma.treatplan.delete({ where: { TreatPlanNum: BigInt(plan._id) } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('should throw when generating claim with no accepted items', async () => {
    const token = uniqueToken('tps-claim');
    const patient = await createPatientRecord(token);
    
    const planData = {
      patientId: patient.PatNum.toString(),
      title: 'Test Claim Plan',
      status: 'Proposed',
      items: [{ procedureCode: 'D1110', fee: 100, status: 'Proposed' }] // Not accepted
    };

    const plan = await treatmentPlanService.createTreatmentPlan(planData);
    
    await expect(treatmentPlanService.generateClaimFromTreatmentPlan(plan._id)).rejects.toThrow('No accepted items in treatment plan');
    
    // cleanup
    await prisma.treatplan.delete({ where: { TreatPlanNum: BigInt(plan._id) } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });
});
