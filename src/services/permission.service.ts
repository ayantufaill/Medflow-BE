import { prisma } from '../config/db';
import type { AppRole, BranchAccess } from '../types/auth.types';
import { GROUP_ADMIN_PERMISSIONS } from '../types/auth.types';
import { mapRole } from '../utils/opendental-auth.util';

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
    let groupClinicIds = effectiveClinicIds;
    if (groupId !== null) {
      const groupClinics = await prisma.clinic.findMany({
        where: { GroupNum: groupId },
        select: { ClinicNum: true },
      });
      groupClinicIds = groupClinics.map((c) => c.ClinicNum);
      // A Group Admin's own management scope (clinicIds) is the whole group too —
      // everyone else keeps clinicIds narrowed to their own assignment and only
      // gets the group-wide view through groupClinicIds (read-visibility only).
      if (isGroupAdmin) {
        effectiveClinicIds = groupClinicIds;
      }
    }

    return { clinicIds: effectiveClinicIds, groupClinicIds, groupId, isGroupAdmin };
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
