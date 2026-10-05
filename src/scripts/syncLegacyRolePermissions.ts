/**
 * Adds the permissions the screen access matrix requires to the legacy roles.
 * Additive and idempotent: existing permissions are kept, nothing is removed.
 *
 *   npx tsx src/scripts/syncLegacyRolePermissions.ts   (dev)
 *   node dist/scripts/syncLegacyRolePermissions.js     (deployed)
 */
import { prisma } from '../config/db';
import { getRoleMeta, setRoleMeta } from '../utils/opendental-auth.util';

const ADDITIONS: Record<string, string[]> = {
  // Finance page: the adjustments panel was 403 ("part"); the matrix says full.
  'Front Desk': ['adjustments.read'],
  Receptionist: ['adjustments.read'],
  Biller: ['adjustments.read'],
  'Billing Staff': ['adjustments.read'],
  // Admin console → Patient Communication settings was empty (403).
  'Group Admin': ['settings.read', 'settings.update'],
  // Insurance and authorizations are "read" for Lab in the matrix.
  Lab: ['insurance.read', 'authorizations.read'],
  'Lab Technician': ['insurance.read', 'authorizations.read'],
};

const main = async () => {
  for (const [roleName, perms] of Object.entries(ADDITIONS)) {
    const role = await prisma.usergroup.findFirst({ where: { Description: roleName } });
    if (!role) {
      console.log(`skip ${roleName}: role not found`);
      continue;
    }
    const meta = await getRoleMeta(role.UserGroupNum);
    const current = (meta.permissions ?? {}) as Record<string, boolean>;
    const missing = perms.filter((p) => current[p] !== true);
    if (missing.length === 0) {
      console.log(`ok   ${roleName}: nothing to add`);
      continue;
    }
    await setRoleMeta(role.UserGroupNum, {
      ...meta,
      permissions: { ...current, ...Object.fromEntries(missing.map((p) => [p, true])) },
    });
    console.log(`add  ${roleName}: ${missing.join(', ')}`);
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
