import { tenantContextStorage } from '../src/config/tenant-context';
import { prisma } from '../src/config/db';

async function main() {
  console.log('--- sanity: override with clinicIds="*" (should see patient 14 if override works at all) ---');
  const r = await tenantContextStorage.run(
    { clinicIds: '*', patientGroupId: '*', userId: '32' },
    () => prisma.patient.findMany({ where: { PatNum: 14n } })
  );
  console.log('count:', r.length);

  console.log('--- override clinicIds=[1n] only (own-branch arm), patient 14 is in clinic 2, should be 0 ---');
  const r2 = await tenantContextStorage.run(
    { clinicIds: [1n], patientGroupId: null, userId: '32' },
    () => prisma.patient.findMany({ where: { PatNum: 14n } })
  );
  console.log('count:', r2.length);

  console.log('--- override clinicIds=[2n] (patient 14 own branch is clinic 2) ---');
  const r3 = await tenantContextStorage.run(
    { clinicIds: [2n], patientGroupId: null, userId: '32' },
    () => prisma.patient.findMany({ where: { PatNum: 14n } })
  );
  console.log('count:', r3.length);
}
main().finally(() => prisma.$disconnect());
