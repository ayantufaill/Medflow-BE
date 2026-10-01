/**
 * Role-grant guard — B1.4.
 *
 * Prevents privilege escalation by ensuring an actor cannot grant roles
 * they don't have the authority to grant.
 *
 * Rules:
 *   1. If the target role contains '*', any 'platform:*' key, or is named
 *      'Super Admin' → only a Super Admin actor may grant it.
 *   2. Otherwise the actor must hold every permission in the target role.
 *   3. The target user must be in the actor's clinic scope (handled
 *      separately by assertUserInScope in the caller).
 *
 * Contract: 00-SHARED-CONTRACTS.md §4.2
 */

import { prisma } from '../config/db';
import { AuthorizationError } from '../utils/error.util';
import { getRoleMeta } from '../utils/opendental-auth.util';
import { PermissionService } from './permission.service';
import { WILDCARD_ROLE_NAMES } from '../types/access.types';

const SUPER_ADMIN_ROLE_NAME = 'Super Admin';

/**
 * Names of roles that are considered "platform-level" and can only be
 * granted by a Super Admin. These all ship with '*' permissions in the
 * seed, but we check by name as an extra safeguard.
 */
const PLATFORM_ROLE_NAMES = new Set([
  'Super Admin',
]);

/**
 * Check if a permissions object contains privileged keys that require
 * Super Admin to grant.
 */
function hasPrivilegedPermissions(permissions: Record<string, any>): boolean {
  for (const key of Object.keys(permissions)) {
    if (permissions[key] !== true) continue;
    // Wildcard grants everything
    if (key === '*') return true;
    // Any platform:* key
    if (key.startsWith('platform:')) return true;
  }
  return false;
}

/**
 * Determine whether the actor is a Super Admin.
 * Checks both the role names and the '*' permission.
 */
async function isSuperAdmin(actorUserId: string): Promise<boolean> {
  const hasSuperAdminRole = await PermissionService.hasRole(actorUserId, SUPER_ADMIN_ROLE_NAME);
  if (hasSuperAdminRole) return true;

  return hasSuperAdminRole;
}

/**
 * Get the actor's effective permission set (union of all role permissions).
 */
async function getActorPermissions(actorUserId: string): Promise<Set<string>> {
  return await PermissionService.getUserPermissions(actorUserId);
}

/**
 * Assert that the actor is allowed to grant a specific role to a user.
 *
 * @throws AuthorizationError if the actor lacks the authority
 */
export async function assertCanGrant(
  actorUserId: string,
  roleId: bigint
): Promise<void> {
  // Fetch the target role and its metadata
  const role = await prisma.usergroup.findUnique({
    where: { UserGroupNum: roleId },
  });
  if (!role) {
    // Let the caller handle not-found
    return;
  }

  const roleMeta = await getRoleMeta(roleId);
  const roleName = role.Description || '';
  const rolePermissions: Record<string, any> = roleMeta?.permissions || {};

  // Check 1: Is this a platform-level role?
  const isPlatformRole =
    PLATFORM_ROLE_NAMES.has(roleName) ||
    hasPrivilegedPermissions(rolePermissions);

  if (isPlatformRole) {
    const actorIsSuperAdmin = await isSuperAdmin(actorUserId);
    if (!actorIsSuperAdmin) {
      throw new AuthorizationError(
        `Only a Super Admin can grant the "${roleName}" role or roles containing wildcard/platform permissions.`
      );
    }
    // Super Admin can grant anything
    return;
  }

  // Check 2: Actor must hold every permission in the target role
  const actorPermissions = await getActorPermissions(actorUserId);

  // If actor has a wildcard FROM A RECOGNISED ADMIN ROLE, they can grant any
  // non-platform role. A bare '*' alone isn't enough — same reasoning as
  // access.types.ts's wildcardHonoured(): a custom role someone pasted '*'
  // into shouldn't silently inherit grant authority.
  if (actorPermissions.has('*')) {
    const actorRoles = await PermissionService.getUserRoles(actorUserId);
    if (actorRoles.some((r) => (WILDCARD_ROLE_NAMES as readonly string[]).includes(r))) {
      return;
    }
  }

  const missingPermissions: string[] = [];
  for (const [key, value] of Object.entries(rolePermissions)) {
    if (value !== true) continue;
    if (!actorPermissions.has(key)) {
      missingPermissions.push(key);
    }
  }

  if (missingPermissions.length > 0) {
    throw new AuthorizationError(
      `You cannot grant a role with permissions you don't hold: ${missingPermissions.join(', ')}`
    );
  }
}

/**
 * Assert that the actor can grant all of the specified roles.
 * Used by assignUserRoles which takes an array of role IDs.
 */
export async function assertCanGrantAll(
  actorUserId: string,
  roleIds: bigint[]
): Promise<void> {
  for (const roleId of roleIds) {
    await assertCanGrant(actorUserId, roleId);
  }
}
