import { prisma } from './src/config/db';
import { treatmentPlanService } from './src/services/treatment-plan.service';

async function run() {
  const patients = await prisma.patient.findMany({ take: 5, select: { PatNum: true, FName: true, LName: true } });
  console.log(patients);

  const patNum = patients[0].PatNum;

  const items = [{
    id: 'v-1',
    label: 'Visit 1',
    procedures: [
      { code: 'D2150', fee: '\.00' }
    ]
  }];

  console.log('Testing create for patient: ' + patNum);
  const newPlan = await treatmentPlanService.createTreatmentPlan({
    patientId: String(patNum),
    title: 'Test Plan',
    items: items
  });
  console.log(JSON.stringify(newPlan, null, 2));

  console.log('Testing update on the new plan:');
  const items2 = [{
    id: 'v-1',
    label: 'Visit 1',
    procedures: [
      { code: 'D2140', fee: '\.00' },
      { code: 'D2160', fee: '\.00' }
    ]
  }];
  const updatedPlan = await treatmentPlanService.updateTreatmentPlan(newPlan._id, {
    items: items2
  });
  console.log(JSON.stringify(updatedPlan, null, 2));
}
run();
