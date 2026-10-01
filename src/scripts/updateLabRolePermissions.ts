import { prisma } from '../config/db';
import { getRoleMeta, setRoleMeta } from '../utils/opendental-auth.util';

const LAB_ROLE_PERMISSIONS = {
  'clinical.cross_branch.view': true,
  'patients.read_basic': true,
  'appointments.read': true,
  'documents.read': true,
  'lab-orders.read': true,
  'lab-orders.update': true,
  'lab-results.read': true,
  'lab-results.create': true,
  'lab-results.update': true,
  'services.read': true,
};

const LAB_ROLE_NAMES = ['Lab', 'Lab Technician'];

const main = async () => {
  const roles = await prisma.usergroup.findMany({
    where: { Description: { in: LAB_ROLE_NAMES } },
  });

  const found = new Set(roles.map((role) => role.Description));
  const missing = LAB_ROLE_NAMES.filter((roleName) => !found.has(roleName));
  if (missing.length > 0) {
    throw new Error(`Missing role(s): ${missing.join(', ')}`);
  }

  for (const role of roles) {
    const existingMeta = await getRoleMeta(role.UserGroupNum);
    await setRoleMeta(role.UserGroupNum, {
      ...existingMeta,
      description: 'Dental Lab Technician - lab cases and basic patient identification only.',
      permissions: LAB_ROLE_PERMISSIONS,
      isSystemRole: existingMeta.isSystemRole ?? true,
      isActive: existingMeta.isActive ?? true,
    });
    console.log(`Updated ${role.Description} (${role.UserGroupNum.toString()})`);
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
