import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOG } from '../constants/permission-catalog';
import { getRolesMeta } from '../utils/opendental-auth.util';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating permissions to tables...');

  // 1. Seed permission_def
  console.log('Seeding permission_def...');
  const catalogKeys = new Set<string>();
  for (const perm of PERMISSION_CATALOG) {
    catalogKeys.add(perm.key);
    await prisma.permission_def.upsert({
      where: { key: perm.key },
      update: {
        module: perm.module,
        description: perm.description,
        is_sensitive: perm.isSensitive,
        lock_date_aware: perm.lockDateAware,
      },
      create: {
        key: perm.key,
        module: perm.module,
        description: perm.description,
        is_sensitive: perm.isSensitive,
        lock_date_aware: perm.lockDateAware,
      },
    });
  }
  console.log(`Seeded ${PERMISSION_CATALOG.length} permissions.`);

  // 2. Migrate roles to role_permission
  console.log('Migrating role permissions...');
  const roles = await prisma.usergroup.findMany();
  const roleIds = roles.map(r => r.UserGroupNum);
  const rolesMeta = await getRolesMeta(roleIds);

  for (const role of roles) {
    const roleIdStr = role.UserGroupNum.toString();
    const meta = rolesMeta[roleIdStr] || {};
    const permissionsJson = meta.permissions || {};
    
    let hasWildcard = false;
    for (const [key, value] of Object.entries(permissionsJson)) {
      const allowed = value === true || (value && typeof value === 'object' && (value as any).allowed === true);
      if (!allowed) continue;

      if (key === '*') {
        hasWildcard = true;
        continue;
      }

      if (!catalogKeys.has(key)) {
        console.warn(`[WARN] Role ${role.Description} (${role.UserGroupNum}) holds uncataloged permission: '${key}'`);
        continue;
      }

      // Upsert role_permission to the database
      await prisma.role_permission.upsert({
        where: {
          role_id_permission_key: {
            role_id: role.UserGroupNum,
            permission_key: key,
          },
        },
        update: {},
        create: {
          role_id: role.UserGroupNum,
          permission_key: key,
        },
      });
    }

    if (hasWildcard) {
      console.log(`[INFO] Role ${role.Description} (${role.UserGroupNum}) holds wildcard '*'`);
    }
  }

  // 3. Super Admin -> user_access_profile.is_platform_admin = true
  console.log('Granting platform admin to Super Admins...');
  const superAdminRole = roles.find((r) => r.Description === 'Super Admin');
  if (superAdminRole) {
    const attachments = await prisma.usergroupattach.findMany({
      where: { UserGroupNum: superAdminRole.UserGroupNum },
    });

    for (const attachment of attachments) {
      if (!attachment.UserNum) continue;
      await prisma.user_access_profile.upsert({
        where: { user_num: attachment.UserNum },
        update: { is_platform_admin: true },
        create: {
          user_num: attachment.UserNum,
          is_platform_admin: true,
          access_all_clinics: false,
          access_version: 0,
        },
      });
    }
    console.log(`Granted platform admin to ${attachments.length} users.`);
  }

  console.log('Migration complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
