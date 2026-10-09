/**
 * Adds the permissions the screen access matrix requires to the legacy roles.
 * Additive and idempotent: existing permissions are kept, nothing is removed.
 *
 *   npx tsx src/scripts/syncLegacyRolePermissions.ts   (dev)
 *   node dist/scripts/syncLegacyRolePermissions.js     (deployed)
 */
import { prisma } from '../config/db';
import { getRoleMeta, setRoleMeta } from '../utils/opendental-auth.util';

const COB_FULL = [
  'insurance.coverage_order.read',
  'insurance.coverage_order.override',
  'insurance.coverage_order.resolve_flag',
  'insurance.coverage_detail.edit',
  'insurance.payer_reported.write',
  'insurance.plan_master.read',
  'insurance.plan_master.edit',
];

const ADDITIONS: Record<string, string[]> = {
  // Finance page: the adjustments panel was 403 ("part"); the matrix says full.
  // COB: seedRoles.ts gives the operations group every COB key, but roles
  // seeded before COB shipped never got them (biller couldn't override).
  'Front Desk': ['adjustments.read', ...COB_FULL],
  Receptionist: ['adjustments.read', ...COB_FULL],
  Biller: ['adjustments.read', ...COB_FULL],
  'Billing Staff': ['adjustments.read', ...COB_FULL],
  // COB: clinical roles read the insurance order (seedRoles.ts
  // CLINICAL_GROUP_PERMISSIONS); missing on roles seeded before COB shipped.
  Provider: ['insurance.coverage_order.read'],
  Doctor: ['insurance.coverage_order.read'],
  Hygienist: ['insurance.coverage_order.read'],
  Assistant: ['insurance.coverage_order.read'],
  'Dental Assistant': ['insurance.coverage_order.read'],
  'Clinical Staff': ['insurance.coverage_order.read'],
  // Admin console → Patient Communication settings was empty (403).
  'Group Admin': ['settings.read', 'settings.update'],
  // Insurance and authorizations are "read" for Lab in the matrix, which
  // includes seeing the patient's insurance order (COB).
  Lab: ['insurance.read', 'authorizations.read', 'insurance.coverage_order.read'],
  'Lab Technician': ['insurance.read', 'authorizations.read', 'insurance.coverage_order.read'],
  // New-model roles on databases seeded before seedNewModelRoles.ts carried
  // the COB keys: without coverage_order.read the patient's Insurance tab
  // says "You don't have permission to see the insurance order". Insurance
  // "Full" roles get the edit keys too (group_admin inherits branch_admin).
  branch_admin: COB_FULL,
  billing: COB_FULL,
  front_desk: ['insurance.coverage_order.read'],
  dentist: ['insurance.coverage_order.read'],
  hygienist: ['insurance.coverage_order.read'],
  dental_assistant: ['insurance.coverage_order.read'],
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
