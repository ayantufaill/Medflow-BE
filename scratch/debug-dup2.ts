import { tenantContextStorage } from '../src/config/tenant-context';
import { prisma } from '../src/config/db';

async function main() {
  const strongMatchWhere: any = {
    FName: { equals: 'Robert' },
    LName: { equals: 'Johnson' },
    Birthdate: new Date('1955-12-03'),
    OR: [
      { WirelessPhone: '12675559701' },
      { HmPhone: '12675559701' },
      { WkPhone: '12675559701' },
      { Email: 'robert.johnson@example.com' },
    ],
  };

  console.log('--- without any override (should be 0, no context) ---');
  const r0 = await prisma.patient.findMany({ where: strongMatchWhere });
  console.log('count:', r0.length);

  console.log('--- with override, clinicIds=[1], patientGroupId=2, sharing IDENTITY:GROUP_READ ---');
  const r1 = await tenantContextStorage.run(
    {
      clinicIds: [1n],
      patientGroupId: 2,
      userId: '32',
      sharing: 'IDENTITY:GROUP_READ,CLINICAL:OWN_BRANCH,IMAGING:OWN_BRANCH,APPOINTMENTS:OWN_BRANCH,FINANCIAL:OWN_BRANCH,INSURANCE:OWN_BRANCH',
    },
    () => prisma.patient.findMany({ where: strongMatchWhere })
  );
  console.log('count:', r1.length, JSON.stringify(r1.map(p => ({PatNum: p.PatNum.toString(), GroupNum: p.GroupNum, ClinicNum: p.ClinicNum?.toString()}))));

  console.log('--- same override but query by just name+DOB (no OR), to isolate whether OR is the problem ---');
  const r2 = await tenantContextStorage.run(
    { clinicIds: [1n], patientGroupId: 2, userId: '32', sharing: 'IDENTITY:GROUP_READ' },
    () => prisma.patient.findMany({ where: { FName: 'Robert', LName: 'Johnson', Birthdate: new Date('1955-12-03') } })
  );
  console.log('count:', r2.length);

  console.log('--- raw SQL check inside same override: what does current_setting read as? ---');
  await tenantContextStorage.run(
    { clinicIds: [1n], patientGroupId: 2, userId: '32', sharing: 'IDENTITY:GROUP_READ' },
    async () => {
      const rows: any = await prisma.$queryRaw`SELECT current_setting('app.patient_group_id', true) as gid, current_setting('app.shared', true) as shared, mf.shared_mode('IDENTITY') as mode`;
      console.log(rows);
    }
  );
}
main().finally(() => prisma.$disconnect());
