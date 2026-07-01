import { prisma } from '../config/db';
import type { AppRole } from '../types/auth.types';
import { mapRole } from '../utils/opendental-auth.util';

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

  static async canAccessResource(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string
  ): Promise<boolean> {
    if (await this.hasRole(userId, 'Admin')) {
      return true;
    }

    if (resourceType === 'patient') {
      return false;
    }

    return false;
  }
}
