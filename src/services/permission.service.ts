import { prisma } from '../config/db';
import type { AppRole, BranchAccess } from '../types/auth.types';
import { GROUP_ADMIN_PERMISSIONS, PLATFORM_ADMIN_PERMISSIONS, BRANCH_ADMIN_PERMISSIONS } from '../types/auth.types';
import { mapRole } from '../utils/opendental-auth.util';
import { AuthorizationError } from '../utils/error.util';

// Resource types scoped by clinic.ClinicNum, and how to look up their clinic.
const CLINIC_SCOPED_RESOURCES: Record<string, { findClinicNum: (id: bigint) => Promise<bigint | null> }> = {
  patient: {
    findClinicNum: async (id) =>
      (await prisma.patient.findUnique({ where: { PatNum: id }, select: { ClinicNum: true } }))
        ?.ClinicNum ?? null,
  },
  appointment: {
    findClinicNum: async (id) =>
      (await prisma.appointment.findUnique({ where: { AptNum: id }, select: { ClinicNum: true } }))
        ?.ClinicNum ?? null,
  },
  claim: {
    findClinicNum: async (id) =>
      (await prisma.claim.findUnique({ where: { ClaimNum: id }, select: { ClinicNum: true } }))
        ?.ClinicNum ?? null,
  },
  payment: {
    findClinicNum: async (id) =>
      (await prisma.payment.findUnique({ where: { PayNum: id }, select: { ClinicNum: true } }))
        ?.ClinicNum ?? null,
  },
};

export class PermissionService {
  static async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await prisma.usergroupattach.findMany({
      where: { UserNum: BigInt(userId) },
      include: { usergroup: true },
    });

    const roles = await Promise.all(
      userRoles
        .filter((ur) => ur.usergroup)
        .map((ur) => mapRole(ur.usergroup))
    );

    return roles.filter((role) => role.isActive !== false).map((role) => role.name);
  }

  static async getUserPermissions(userId: string): Promise<Set<string>> {
    const userRoles = await prisma.usergroupattach.findMany({
      where: { UserNum: BigInt(userId) },
      include: { usergroup: true },
    });

    const permissions = new Set<string>();
    const roles = await Promise.all(
      userRoles
        .filter((ur) => ur.usergroup)
        .map((ur) => mapRole(ur.usergroup))
    );

    for (const role of roles) {
      if (role.permissions) {
        for (const [permission, allowed] of Object.entries(role.permissions)) {
          if (allowed) permissions.add(permission);
        }
      }
    }

    return permissions;
  }

  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.has('*') || permissions.has(permission);
  }

  static async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    if (userPermissions.has('*')) return true;
    return permissions.some((perm) => userPermissions.has(perm));
  }

  static async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    if (userPermissions.has('*')) return true;
    return permissions.every((perm) => userPermissions.has(perm));
  }

  static async hasRole(userId: string, roleName: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.includes(roleName);
  }

  static async hasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roleNames.some((role) => roles.includes(role));
  }

  static async getRoleByName(roleName: string): Promise<AppRole | null> {
    const role = await prisma.usergroup.findFirst({
      where: { Description: roleName },
    });
    if (!role) return null;
    const mapped = await mapRole(role);
    return mapped.isActive === false ? null : mapped;
  }

  static async getAllRoles(): Promise<AppRole[]> {
    const roles = await prisma.usergroup.findMany();
    const mapped = await Promise.all(roles.map((r) => mapRole(r)));
    return mapped.filter((role) => role.isActive !== false);
  }

  /**
   * Raw branch *assignment* (not access scope) — which clinics this user is
   * actually tied to via `userclinic`/`userod.ClinicNum`, with no group-admin
   * expansion. Distinct from getBranchAccess: a Group Admin's access scope
   * expands to their whole group, but their assignment is still just their
   * own home branch — this is what a "which branch is this user in" UI wants.
   */
  static async getAssignedBranchIds(userId: string): Promise<string[]> {
    const map = await this.getAssignedBranchIdsBatch([userId]);
    return map.get(userId) ?? [];
  }

  static async getAssignedBranchIdsBatch(userIds: string[]): Promise<Map<string, string[]>> {
    const userNums = userIds.map((id) => BigInt(id));
    const result = new Map<string, string[]>(userIds.map((id) => [id, []]));

    const assignments = await prisma.userclinic.findMany({
      where: { UserNum: { in: userNums } },
      select: { UserNum: true, ClinicNum: true },
    });
    for (const a of assignments) {
      if (!a.UserNum || !a.ClinicNum) continue;
      const key = a.UserNum.toString();
      const list = result.get(key) ?? [];
      const clinicIdStr = a.ClinicNum.toString();
      if (!list.includes(clinicIdStr)) list.push(clinicIdStr);
      result.set(key, list);
    }

    const users = await prisma.userod.findMany({
      where: { UserNum: { in: userNums } },
      select: { UserNum: true, ClinicNum: true },
    });
    for (const u of users) {
      if (!u.ClinicNum) continue;
      const key = u.UserNum.toString();
      const list = result.get(key) ?? [];
      const clinicIdStr = u.ClinicNum.toString();
      if (!list.includes(clinicIdStr)) list.push(clinicIdStr);
      result.set(key, list);
    }

    return result;
  }

  /**
   * Authorizes reassigning a resource's branch(es) — shared by both the
   * user-branch and provider-branch reassignment endpoints, since the rule is
   * identical: who may move something from `currentBranchIds` to
   * `newBranchIds`.
   *
   * - Super Admin (platform:manage_practice_groups): any branch, any group.
   * - Group Admin (groupPermission, e.g. group:manage_users /
   *   group:reassign_providers): only if BOTH the current and the requested
   *   branches are entirely within the caller's own group — prevents pulling
   *   a resource out of, or into, a group that isn't theirs.
   * - Branch Admin (branch:manage_users): only if BOTH the current and the
   *   requested branches are exactly the caller's own assigned branch(es) —
   *   no group-wide reach at all.
   *
   * Throws AuthorizationError if none apply.
   */
  static async assertCanManageBranchAssignment(
    callerId: string,
    currentBranchIds: string[],
    newBranchIds: string[],
    groupPermission: string
  ): Promise<void> {
    const hasPlatformPermission = await this.hasPermission(
      callerId,
      PLATFORM_ADMIN_PERMISSIONS.MANAGE_PRACTICE_GROUPS
    );
    if (hasPlatformPermission) return;

    const callerAccess = await this.getBranchAccess(callerId);
    const hasGroupPermission = await this.hasPermission(callerId, groupPermission);
    if (hasGroupPermission && callerAccess.isGroupAdmin && callerAccess.groupId !== null) {
      const allowed = new Set(callerAccess.clinicIds.map((id) => id.toString()));
      const newOk = newBranchIds.length > 0 && newBranchIds.every((id) => allowed.has(id));
      const currentOk = currentBranchIds.length === 0 || currentBranchIds.every((id) => allowed.has(id));
      if (newOk && currentOk) return;
    }

    const hasBranchPermission = await this.hasPermission(callerId, BRANCH_ADMIN_PERMISSIONS.MANAGE_USERS);
    if (hasBranchPermission) {
      const ownBranches = await this.getAssignedBranchIds(callerId);
      const allowed = new Set(ownBranches);
      const newOk = newBranchIds.length > 0 && newBranchIds.every((id) => allowed.has(id));
      const currentOk = currentBranchIds.length === 0 || currentBranchIds.every((id) => allowed.has(id));
      if (newOk && currentOk) return;
    }

    throw new AuthorizationError('You do not have access to manage this branch assignment.');
  }

  /**
   * Resolves which ClinicNums a user may access: their `userclinic` assignments
   * (plus their `userod.ClinicNum` home clinic), expanded to every clinic in
   * their practicegroup if they hold a GROUP_ADMIN_PERMISSIONS permission.
   */
  static async getBranchAccess(userId: string): Promise<BranchAccess> {
    const userNum = BigInt(userId);

    const assignments = await prisma.userclinic.findMany({
      where: { UserNum: userNum },
      select: { ClinicNum: true },
    });
    const clinicIds = new Set<bigint>(
      assignments.map((a) => a.ClinicNum).filter((id): id is bigint => id !== null)
    );

    const user = await prisma.userod.findUnique({
      where: { UserNum: userNum },
      select: { ClinicNum: true },
    });
    if (user?.ClinicNum !== null && user?.ClinicNum !== undefined) {
      clinicIds.add(user.ClinicNum);
    }

    const permissions = await this.getUserPermissions(userId);
    const isGroupAdmin =
      permissions.has('*') ||
      Object.values(GROUP_ADMIN_PERMISSIONS).some((perm) => permissions.has(perm));

    let groupId: number | null = null;
    const [firstClinicId] = clinicIds;
    if (firstClinicId !== undefined) {
      const homeClinic = await prisma.clinic.findUnique({
        where: { ClinicNum: firstClinicId },
        select: { GroupNum: true },
      });
      groupId = homeClinic?.GroupNum ?? null;
    }

    let effectiveClinicIds = Array.from(clinicIds);
    if (isGroupAdmin && groupId !== null) {
      const groupClinics = await prisma.clinic.findMany({
        where: { GroupNum: groupId },
        select: { ClinicNum: true },
      });
      effectiveClinicIds = groupClinics.map((c) => c.ClinicNum);
    }

    return { clinicIds: effectiveClinicIds, groupId, isGroupAdmin };
  }

  static async canAccessResource(
    userId: string,
    resourceType: string,
    resourceId: string,
    _action: string
  ): Promise<boolean> {
    if (await this.hasRole(userId, 'Admin')) {
      return true;
    }

    const resourceConfig = CLINIC_SCOPED_RESOURCES[resourceType];
    if (!resourceConfig) {
      return false;
    }

    const resourceClinicNum = await resourceConfig.findClinicNum(BigInt(resourceId));
    if (resourceClinicNum === null) {
      return false;
    }

    const branchAccess = await this.getBranchAccess(userId);
    return branchAccess.clinicIds.includes(resourceClinicNum);
  }
}
