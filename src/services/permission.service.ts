import { RoleModel } from '../models/role.model';
import { UserRoleModel } from '../models/user-role.model';
import type { Role } from '../models/role.model';

/**
 * Permission Service
 * Handles permission checking and role management
 */
export class PermissionService {
  /**
   * Get all roles for a user
   */
  static async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await UserRoleModel.find({ userId })
      .populate<{ roleId: Role }>('roleId')
      .lean();

    return userRoles
      .map((ur) => {
        const role = ur.roleId as Role;
        return role && role.isActive ? role.name : null;
      })
      .filter((name): name is string => Boolean(name));
  }

  /**
   * Get all permissions for a user (from all their roles)
   */
  static async getUserPermissions(userId: string): Promise<Set<string>> {
    const userRoles = await UserRoleModel.find({ userId })
      .populate<{ roleId: Role }>('roleId')
      .lean();

    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      const role = userRole.roleId as Role;
      if (role && role.permissions) {
        // Handle permissions as object (Mixed type) or Map
        const rolePermissions = role.permissions;
        if (rolePermissions instanceof Map) {
          for (const [permission, allowed] of rolePermissions.entries()) {
            if (allowed) {
              permissions.add(permission);
            }
          }
        } else if (typeof rolePermissions === 'object' && rolePermissions !== null) {
          // Handle as plain object
          for (const [permission, allowed] of Object.entries(rolePermissions)) {
            if (allowed) {
              permissions.add(permission);
            }
          }
        }
      }
    }

    return permissions;
  }

  /**
   * Check if user has a specific permission
   */
  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.has(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  static async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some((perm) => userPermissions.has(perm));
  }

  /**
   * Check if user has all of the specified permissions
   */
  static async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every((perm) => userPermissions.has(perm));
  }

  /**
   * Check if user has a specific role
   */
  static async hasRole(userId: string, roleName: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.includes(roleName);
  }

  /**
   * Check if user has any of the specified roles
   */
  static async hasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roleNames.some((role) => roles.includes(role));
  }

  /**
   * Get role by name
   */
  static async getRoleByName(roleName: string): Promise<Role | null> {
    return await RoleModel.findOne({ name: roleName, isActive: true }).lean();
  }

  /**
   * Get all active roles
   */
  static async getAllRoles(): Promise<Role[]> {
    return await RoleModel.find({ isActive: true }).lean();
  }

  /**
   * Check if user can access a resource (for resource-level permissions)
   * This is a helper for checking ownership or specific access rules
   */
  static async canAccessResource(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string
  ): Promise<boolean> {
    // Admin has access to everything
    if (await this.hasRole(userId, 'Admin')) {
      return true;
    }

    // For patient resources, check if user is the patient
    if (resourceType === 'patient') {
      // This would need to check if userId matches the patient's userId
      // Implementation depends on your patient model structure
      return false; // Placeholder
    }

    // Add more resource-specific checks as needed
    return false;
  }
}

