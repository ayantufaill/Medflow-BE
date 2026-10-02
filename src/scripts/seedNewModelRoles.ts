/**
 * Seeds the new 8(+1)-role RBAC model, added ALONGSIDE the legacy roles in
 * seedRoles.ts — this is a phased rollout, nothing legacy is touched here.
 *
 * Roles: group_admin, branch_admin, dentist, hygienist, dental_assistant,
 * front_desk, billing, and the existing "Lab" row (reused, not duplicated,
 * per the explicit decision to keep Lab as an internal 9th role rather than
 * move it to the external dental_lab portal).
 *
 * Each role's meta carries:
 *   - isNewModel: true   — marks it as part of this model (vs. legacy)
 *   - roleKey: '...'     — stable machine key, used by rbac.service.ts
 *   - isPlatformRole: false — none of these are platform/vendor roles
 *
 * group_admin deliberately stores NO permissions of its own beyond the
 * group-only extras below — rbac.service.ts's resolveEffectivePermissions()
 * unions in branch_admin's live permission set at request time, so editing
 * branch_admin later automatically propagates to every group_admin without
 * a reseed.
 *
 * Usage: npx tsx src/scripts/seedNewModelRoles.ts
 */
// Unrestricted tenant context for RLS — must be imported before any query.
import '../config/seed-context';
import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { setRoleMeta } from '../utils/opendental-auth.util';

const DENTIST_PERMISSIONS = {
  // Without this, requirePhiAccess rejects every patient/clinical route —
  // same bug class fixed on the legacy roles earlier; the new-model roles
  // need the same grant since own-branch access depends on it too, not just
  // cross-branch sharing.
  'clinical.cross_branch.view': true,
  'patients.read': true,
  'appointments.read': true,
  'appointments.update': true,
  'appointments.schedule': true,
  'clinical-notes.read': true,
  'clinical-notes.create': true,
  'clinical-notes.update': true,
  'clinical-notes.sign': true,
  'vital-signs.read': true,
  'vital-signs.create': true,
  'vital-signs.update': true,
  'prescriptions.read': true,
  'prescriptions.create': true,
  'prescriptions.update': true,
  'treatment-plans.read': true,
  'treatment-plans.create': true,
  'treatment-plans.update': true,
  'treatment-plans.sign': true,
  'documents.read': true,
  'documents.create': true,
  'lab-orders.read': true,
  'lab-orders.create': true,
  'lab-orders.update': true,
  'lab-results.read': true,
  'referrals.read': true,
  'referrals.create': true,
  'referrals.update': true,
  'authorizations.read': true,
  'authorizations.create': true,
  'services.read': true,
  'insurance.read': true,
  'invoices.read': true,
};

// Hygienist: clinical write, but per the spec explicitly cannot SIGN
// treatment plans (can still read/draft them) — the one deliberate
// difference from dentist.
const HYGIENIST_PERMISSIONS: Record<string, boolean> = { ...DENTIST_PERMISSIONS };
delete HYGIENIST_PERMISSIONS['treatment-plans.sign'];

const DENTAL_ASSISTANT_PERMISSIONS = {
  'clinical.cross_branch.view': true,
  'patients.read': true,
  'appointments.read': true,
  'clinical-notes.read': true,
  'clinical-notes.create': true,
  'vital-signs.read': true,
  'vital-signs.create': true,
  'treatment-plans.read': true,
  'documents.read': true,
  'documents.create': true,
  'lab-orders.read': true,
  'services.read': true,
  // "read-only financials" per spec
  'invoices.read': true,
  'insurance.read': true,
};

const FRONT_DESK_PERMISSIONS = {
  'clinical.cross_branch.view': true,
  'patients.read': true,
  'patients.create': true,
  'patients.update': true,
  'appointments.read': true,
  'appointments.create': true,
  'appointments.update': true,
  'appointments.schedule': true,
  'appointments.cancel': true,
  'documents.read': true,
  'documents.create': true,
  'insurance.read': true,
  'services.read': true,
};

const BILLING_PERMISSIONS = {
  'clinical.cross_branch.view': true,
  'patients.read': true,
  'invoices.read': true,
  'invoices.create': true,
  'invoices.update': true,
  'invoices.delete': true,
  'invoices.process': true,
  'payments.read': true,
  'payments.create': true,
  'payments.update': true,
  'payments.delete': true,
  'payments.process': true,
  'claims.read': true,
  'claims.create': true,
  'claims.update': true,
  'claims.delete': true,
  'claims.process': true,
  'era.read': true,
  'era.create': true,
  'era.update': true,
  'era.delete': true,
  'era.process': true,
  'adjustments.read': true,
  'adjustments.create': true,
  'adjustments.update': true,
  'adjustments.delete': true,
  'insurance.read': true,
  'insurance.create': true,
  'insurance.update': true,
  'insurance.delete': true,
  'reports.financial': true,
};

// Bounded and explicit — NOT '*'. This is the whole point of the new model:
// branch_admin is a named permission set, unlike the legacy Branch Admin
// role which holds the full wildcard.
const BRANCH_ADMIN_PERMISSIONS = {
  'patients.read': true,
  'patients.create': true,
  'patients.update': true,
  'appointments.read': true,
  'appointments.create': true,
  'appointments.update': true,
  'appointments.delete': true,
  'appointments.schedule': true,
  'appointments.cancel': true,
  'users.read': true,
  'users.create': true,
  'users.update': true,
  'reports.access': true,
  // Report and KPI routes check reports.read; without it admins get 403 on /kpi.
  'reports.read': true,
  'reports.financial': true,
  'reports.administrative': true,
  'branches.read': true,
  'branches.update': true,
  'practice-info.read': true,
  'practice-info.update': true,
  'security.audit.view': true,
  'insurance.read': true,
  'insurance.create': true,
  'insurance.update': true,
  'insurance.delete': true,
  'invoices.read': true,
  'invoices.create': true,
  'invoices.update': true,
  'documents.read': true,
  'documents.create': true,
  'services.read': true,
  // Without this, requirePhiAccess rejects branch_admin on every patient
  // route — same bug class fixed on the legacy Admin/Branch Admin roles
  // earlier this session.
  'clinical.cross_branch.view': true,
};

// group_admin's OWN permissions, beyond what it inherits live from
// branch_admin via resolveEffectivePermissions().
const GROUP_ADMIN_OWN_PERMISSIONS = {
  'group:view_analytics': true,
  'group:manage_users': true,
  'group:reassign_providers': true,
  'branches.create': true,
};

const roles: Array<{
  roleKey: string;
  description: string;
  permissions: Record<string, boolean>;
}> = [
  { roleKey: 'group_admin', description: 'Cross-branch group administrator. Inherits all branch_admin permissions for every branch in their group.', permissions: GROUP_ADMIN_OWN_PERMISSIONS },
  { roleKey: 'branch_admin', description: 'Branch administrator — own branch only.', permissions: BRANCH_ADMIN_PERMISSIONS },
  { roleKey: 'dentist', description: 'Clinical write, sign and lock treatment plans and clinical notes.', permissions: DENTIST_PERMISSIONS },
  { roleKey: 'hygienist', description: 'Clinical write; cannot sign treatment plans.', permissions: HYGIENIST_PERMISSIONS },
  { roleKey: 'dental_assistant', description: 'Clinical support, read-only financials.', permissions: DENTAL_ASSISTANT_PERMISSIONS },
  { roleKey: 'front_desk', description: 'Scheduling, registration, check-in/out.', permissions: FRONT_DESK_PERMISSIONS },
  { roleKey: 'billing', description: 'Full claims, ERA, adjustments, write-offs.', permissions: BILLING_PERMISSIONS },
];

async function upsertNewModelRole(roleKey: string, description: string, permissions: Record<string, boolean>) {
  const existing = await prisma.usergroup.findFirst({ where: { Description: roleKey } });

  if (existing) {
    await setRoleMeta(existing.UserGroupNum, {
      description,
      permissions,
      isSystemRole: true,
      isActive: true,
      isNewModel: true,
      roleKey,
      isPlatformRole: false,
    });
    console.log(`Updated new-model role: ${roleKey} (UserGroupNum ${existing.UserGroupNum})`);
    return;
  }

  const nextId = await getNextId('usergroup', 'UserGroupNum');
  const role = await prisma.usergroup.create({
    data: { UserGroupNum: nextId, Description: roleKey },
  });
  await setRoleMeta(role.UserGroupNum, {
    description,
    permissions,
    isSystemRole: true,
    isActive: true,
    isNewModel: true,
    roleKey,
    isPlatformRole: false,
  });
  console.log(`Created new-model role: ${roleKey} (UserGroupNum ${role.UserGroupNum})`);
}

async function tagLabAsNewModel() {
  // Reuse the existing "Lab" usergroup row rather than creating a duplicate —
  // explicit decision to keep Lab as a 9th internal staff role.
  const lab = await prisma.usergroup.findFirst({ where: { Description: 'Lab' } });
  if (!lab) {
    console.warn('No existing "Lab" usergroup row found — skipping (seed:roles should run first).');
    return;
  }
  const { getRoleMeta } = await import('../utils/opendental-auth.util');
  const meta = await getRoleMeta(lab.UserGroupNum);
  await setRoleMeta(lab.UserGroupNum, {
    ...meta,
    isNewModel: true,
    roleKey: 'lab',
    isPlatformRole: false,
  });
  console.log(`Tagged existing "Lab" role as new-model (UserGroupNum ${lab.UserGroupNum}), permissions unchanged.`);
}

async function main() {
  for (const role of roles) {
    await upsertNewModelRole(role.roleKey, role.description, role.permissions);
  }
  await tagLabAsNewModel();
  console.log('\nNew-model roles seeded successfully (legacy roles untouched).');
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
