import { patientService } from '../src/services/patient.service';
import { PermissionService } from '../src/services/permission.service';
import { prisma } from '../src/config/db';

async function main() {
  const userId = '32';
  const branchAccess = await PermissionService.getBranchAccess(userId);
  console.log('branchAccess:', JSON.stringify(branchAccess, (k,v) => typeof v === 'bigint' ? v.toString() : v));

  const result = await patientService.findDuplicatePatients({
    firstName: 'Robert',
    lastName: 'Johnson',
    dateOfBirth: new Date('1955-12-03'),
    phonePrimary: '12675559701',
    email: 'robert.johnson@example.com',
  }, userId);
  console.log('result count:', result.length);
  console.log(JSON.stringify(result, null, 2));
}
main().finally(() => prisma.$disconnect());
