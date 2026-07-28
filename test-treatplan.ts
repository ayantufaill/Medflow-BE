
import { treatmentPlanService } from './src/services/treatment-plan.service';
import { prisma } from './src/config/db';

async function run() {
  try {
    const patPlan = await prisma.patplan.findFirst({
      where: { IsPending: 0, PatNum: { not: null } },
      orderBy: { Ordinal: 'asc' }
    });

    if (!patPlan || !patPlan.PatNum) {
      console.log('No patient with active patplan found.');
      return;
    }

    const patientId = patPlan.PatNum.toString();
    console.log(Testing with Patient ID: );

    const res = await treatmentPlanService.createTreatmentPlan({
      patientId,
      title: 'Test Plan',
      items: [
        {
          serviceId: '2',
          code: 'D0120',
          charge: 50,
        },
        {
          serviceId: '12',
          code: 'D2140',
          charge: 150,
        }
      ]
    });

    console.log('Created Plan:', JSON.stringify(res, null, 2));
    await treatmentPlanService.deleteTreatmentPlan(res._id);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.();
  }
}

run();

