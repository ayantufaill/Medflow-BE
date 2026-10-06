/**
 * Role elevation for the new 8(+1)-role model — PATCH /users/:userId/role.
 *
 * Deliberately NOT built on user.service.ts's assignUserRoles (which does a
 * full delete-all-then-insert of EVERY usergroupattach row the target holds)
 * or the dead, unrouted singular assignRole. This endpoint only ever touches
 * the target's new-model attachment, leaving any legacy role (Provider,
 * Branch Admin, etc.) completely untouched — required for the phased
 * rollout, and avoids the full-replace footgun entirely by construction.
 */
import { prisma } from '../config/db';
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { getNewModelRoleForUser, getNewModelRoleByKey } from './rbac.service';
import { PermissionService } from './permission.service';
import { bumpAccessVersion } from './access-version.service';

const PLATFORM_ROLE_KEYS = new Set(['platform_admin', 'super_admin', 'system_admin']);
/** Granted only through the practice-group provisioning flow, never via role elevation. */
const NOT_ELEVATABLE_ROLE_KEYS = new Set(['group_admin']);
/** Roles a branch_admin (without group authority) may not hand out. */
const BRANCH_ADMIN_CANNOT_ASSIGN = new Set(['branch_admin', 'billing']);

export interface ElevateRoleParams {
  actorUserId: string;
  targetUserId: string;
  roleKey: string;
  clinicId?: bigint;
}

/**
 * Who the actor is, for authority purposes. A legacy wildcard admin
 * (Super Admin/Admin/Branch Admin via '*') can still act, per the
 * "don't weaken existing access" rule — but STILL goes through the
 * authority rules below, not a blanket bypass, since this endpoint's whole
 * point is enforcing the new model's specific elevation rules.
 */
async function resolveActorAuthority(actorUserId: string): Promise<{
  isLegacyWildcardAdmin: boolean;
  newModelRoleKey: string | null;
  clinicIds: bigint[] | '*';
}> {
  const [permissions, newModelRole, branchAccess] = await Promise.all([
    PermissionService.getUserPermissions(actorUserId),
    getNewModelRoleForUser(actorUserId),
    PermissionService.getBranchAccess(actorUserId),
  ]);

  return {
    isLegacyWildcardAdmin: permissions.has('*'),
    newModelRoleKey: newModelRole?.roleKey ?? null,
    clinicIds: branchAccess.isGroupAdmin ? branchAccess.groupClinicIds : branchAccess.clinicIds,
  };
}

/**
 * Which role keys this actor may hand out through elevateUserRole(), so the
 * role picker offers exactly what the endpoint will accept. `canAssign` is
 * false for actors who may not change roles at all.
 */
export async function getAssignableRoleRules(
  actorUserId: string
): Promise<{ canAssign: boolean; blockedRoleKeys: Set<string> }> {
  const actor = await resolveActorAuthority(actorUserId);
  const actingAsGroupAdmin = actor.newModelRoleKey === 'group_admin' || actor.isLegacyWildcardAdmin;
  const actingAsBranchAdminOnly = actor.newModelRoleKey === 'branch_admin' && !actingAsGroupAdmin;

  const blockedRoleKeys = new Set([...PLATFORM_ROLE_KEYS, ...NOT_ELEVATABLE_ROLE_KEYS]);
  if (actingAsBranchAdminOnly) {
    for (const key of BRANCH_ADMIN_CANNOT_ASSIGN) blockedRoleKeys.add(key);
  }
  return { canAssign: actingAsGroupAdmin || actingAsBranchAdminOnly, blockedRoleKeys };
}

export async function elevateUserRole({
  actorUserId,
  targetUserId,
  roleKey,
  clinicId,
}: ElevateRoleParams): Promise<{ oldRoleKey: string | null; newRoleKey: string }> {
  if (PLATFORM_ROLE_KEYS.has(roleKey)) {
    throw new AuthorizationError('Platform roles cannot be assigned from the clinical app.');
  }
  if (NOT_ELEVATABLE_ROLE_KEYS.has(roleKey)) {
    throw new AuthorizationError('group_admin can only be granted by another group_admin through the practice-group provisioning flow, not this endpoint.');
  }

  const newRole = await getNewModelRoleByKey(roleKey);
  if (!newRole) {
    throw new ValidationError(`"${roleKey}" is not a recognised assignable role.`);
  }

  const targetUser = await prisma.userod.findUnique({ where: { UserNum: BigInt(targetUserId) } });
  if (!targetUser) {
    throw new NotFoundError('User not found');
  }

  const actor = await resolveActorAuthority(actorUserId);
  const actingAsGroupAdmin = actor.newModelRoleKey === 'group_admin' || actor.isLegacyWildcardAdmin;
  const actingAsBranchAdminOnly = actor.newModelRoleKey === 'branch_admin' && !actingAsGroupAdmin;

  if (!actingAsGroupAdmin && !actingAsBranchAdminOnly) {
    throw new AuthorizationError('Only a group_admin or branch_admin may change a user\'s role.');
  }

  if (actingAsBranchAdminOnly) {
    if (BRANCH_ADMIN_CANNOT_ASSIGN.has(roleKey)) {
      throw new AuthorizationError(`branch_admin cannot assign the "${roleKey}" role.`);
    }
    if (!clinicId) {
      throw new ValidationError('clinicId is required when a branch_admin changes a role.');
    }
    const allowedClinicIds = actor.clinicIds;
    const inScope = allowedClinicIds === '*' || allowedClinicIds.some((id) => id === clinicId);
    if (!inScope) {
      throw new AuthorizationError('branch_admin can only change roles within their own branch.');
    }
  }

  const existing = await getNewModelRoleForUser(targetUserId);

  // The user's current role must be one the actor could have handed out:
  // nobody here demotes a group_admin, and a branch_admin cannot change the
  // role of another branch_admin or of billing.
  if (existing && NOT_ELEVATABLE_ROLE_KEYS.has(existing.roleKey)) {
    throw new AuthorizationError(`A ${existing.roleKey}'s role cannot be changed from here.`);
  }
  if (existing && actingAsBranchAdminOnly && BRANCH_ADMIN_CANNOT_ASSIGN.has(existing.roleKey)) {
    throw new AuthorizationError(`branch_admin cannot change the role of a ${existing.roleKey} user.`);
  }

  await prisma.$transaction(async (tx) => {
    // Only remove the target's EXISTING new-model attachment, if any —
    // every legacy usergroupattach row is left completely alone.
    if (existing) {
      await tx.usergroupattach.deleteMany({
        where: { UserNum: BigInt(targetUserId), UserGroupNum: existing.userGroupNum },
      });
    }

    const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
    await tx.usergroupattach.create({
      data: {
        UserGroupAttachNum: attachId,
        UserNum: BigInt(targetUserId),
        UserGroupNum: newRole.userGroupNum,
      },
    });
  });

  await bumpAccessVersion(BigInt(targetUserId));

  return { oldRoleKey: existing?.roleKey ?? null, newRoleKey: roleKey };
}
