import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { setRoleMeta } from '../utils/opendental-auth.util';

const roles = [
  { name: 'Admin', description: 'Administrator', permissions: { '*': true }, isSystemRole: true },
  { name: 'Provider', description: 'Provider', permissions: {}, isSystemRole: true },
  { name: 'Staff', description: 'Staff', permissions: {}, isSystemRole: true },
  { name: 'Patient', description: 'Patient', permissions: {}, isSystemRole: true },
];

const seedRoles = async () => {
  try {
    for (const roleData of roles) {
      const existing = await prisma.usergroup.findFirst({
        where: { Description: roleData.name },
      });
      if (!existing) {
        const nextId = await getNextId('usergroup', 'UserGroupNum');
        const role = await prisma.usergroup.create({
          data: {
            UserGroupNum: nextId,
            Description: roleData.name,
          },
        });
        await setRoleMeta(role.UserGroupNum, {
          description: roleData.description,
          permissions: roleData.permissions,
          isSystemRole: roleData.isSystemRole,
          isActive: true,
        });
      }
    }
    console.log('Roles seeded successfully!');
  } catch (error) {
    console.error('Error seeding roles:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedRoles();
