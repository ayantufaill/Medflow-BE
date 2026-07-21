import { prisma } from './src/config/db';
import { getPatientInsuranceMeta } from './src/utils/opendental-auth.util';

async function run() {
  const patient = await prisma.patient.findFirst({
    where: { FName: { startsWith: 'Andrew' } }
  });
  console.log('Patient:', patient?.PatNum, patient?.FName, patient?.LName);
  
  if (!patient) return;
  
  const patPlan = await prisma.patplan.findFirst({
    where: { PatNum: patient.PatNum, Ordinal: 1 },
    include: { inssub: true }
  });
  console.log('PatPlanNum:', patPlan?.PatPlanNum);
  
  if (patPlan) {
    const meta = await getPatientInsuranceMeta(patPlan.PatPlanNum);
    console.log('Meta:', JSON.stringify(meta, null, 2));
  }
}
run().finally(() => prisma.$disconnect());
