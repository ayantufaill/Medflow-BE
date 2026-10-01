/**
 * New 8(+1)-role RBAC model — permission resolution.
 *
 * Deliberately a separate file from permission.service.ts rather than
 * entangled with it: the legacy model's getUserPermissions() keeps working
 * completely unchanged (every wildcard-admin fix from earlier today stays
 * intact), and this file only adds new-model roles on top of that, per the
 * phased-rollout decision.
 */
import { prisma } from '../config/db';
import { PermissionService } from './permission.service';
import { getRoleMeta } from '../utils/opendental-auth.util';

export interface NewModelRole {
  userGroupNum: bigint;
  roleKey: string;
  permissions: Record<string, boolean>;
}

/**
 * A user's new-model role, if they have one. A user may ALSO hold legacy
 * usergroupattach rows (Provider, Branch Admin, etc.) — those are untouched
 * and irrelevant here; this looks only at the attachment whose role meta has
 * isNewModel === true.
 */
export async function getNewModelRoleForUser(userId: string): Promise<NewModelRole | null> {
  const userNum = BigInt(userId);
  const attachments = await prisma.usergroupattach.findMany({
    where: { UserNum: userNum },
    include: { usergroup: true },
  });

  for (const attachment of attachments) {
    if (!attachment.usergroup) continue;
    const meta = await getRoleMeta(attachment.usergroup.UserGroupNum);
    if (meta.isNewModel === true) {
      return {
        userGroupNum: attachment.usergroup.UserGroupNum,
        roleKey: meta.roleKey,
        permissions: meta.permissions ?? {},
      };
    }
  }
  return null;
}

export async function getNewModelRoleByKey(roleKey: string): Promise<NewModelRole | null> {
  const role = await prisma.usergroup.findFirst({ where: { Description: roleKey } });
  if (!role) return null;
  const meta = await getRoleMeta(role.UserGroupNum);
  if (meta.isNewModel !== true) return null;
  return {
    userGroupNum: role.UserGroupNum,
    roleKey: meta.roleKey,
    permissions: meta.permissions ?? {},
  };
}

/**
 * Resolves a user's complete effective permission set: their legacy
 * permissions (unchanged, via PermissionService) UNIONED with whatever their
 * new-model role grants.
 *
 * group_admin special case: group_admin stores no clinical permissions of
 * its own — it inherits branch_admin's permission set LIVE, by looking it up
 * on every call rather than copying it at seed time, so editing branch_admin
 * later automatically propagates to every group_admin.
 *
 * can_present_treatment_plan is clinic-conditional and is NOT folded into the
 * cached AccessContext.permissions Set (that cache has no per-clinic axis —
 * see the plan doc for why). Callers that need it must pass opts.clinicId
 * explicitly; it is computed live from clinic.features on every call, so a
 * feature-flag toggle takes effect immediately with no session invalidation
 * needed.
 */
export async function resolveEffectivePermissions(
  userId: string,
  opts?: { clinicId?: bigint }
): Promise<Set<string>> {
  const legacy = await PermissionService.getUserPermissions(userId);
  const resolved = new Set(legacy);

  const newModelRole = await getNewModelRoleForUser(userId);
  if (!newModelRole) return resolved;

  for (const [perm, allowed] of Object.entries(newModelRole.permissions)) {
    if (allowed) resolved.add(perm);
  }

  if (newModelRole.roleKey === 'group_admin') {
    const branchAdmin = await getNewModelRoleByKey('branch_admin');
    for (const [perm, allowed] of Object.entries(branchAdmin?.permissions ?? {})) {
      if (allowed) resolved.add(perm);
    }
  }

  if (opts?.clinicId && (newModelRole.roleKey === 'branch_admin' || newModelRole.roleKey === 'front_desk')) {
    const clinic = await prisma.clinic.findUnique({
      where: { ClinicNum: opts.clinicId },
      select: { features: true },
    });
    const features = (clinic?.features ?? {}) as Record<string, unknown>;
    if (features.treatment_coordinator === true) {
      resolved.add('can_present_treatment_plan');
    }
  }

  return resolved;
}
