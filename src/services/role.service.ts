import { RoleModel } from '../models/role.model';
import { UserRoleModel } from '../models/user-role.model';
import { NotFoundError, ConflictError } from '../utils/error.util';
import type { Role } from '../models/role.model';

export class RoleService {
  /**
   * Get all active roles
   */
  async getAllRoles(page = 1, limit = 100, search?: string) {
    const skip = (page - 1) * limit;
    const query: any = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [roles, total] = await Promise.all([
      RoleModel.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RoleModel.countDocuments(query),
    ]);

    return {
      roles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: string): Promise<Role> {
    const role = await RoleModel.findById(roleId).lean();
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    return role;
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: string): Promise<Role | null> {
    return await RoleModel.findOne({ name, isActive: true }).lean();
  }

  /**
   * Create a new role
   */
  async createRole(data: {
    name: string;
    description?: string;
    permissions?: Map<string, boolean> | Record<string, boolean>;
    isSystemRole?: boolean;
  }): Promise<Role> {
    // Check if role with same name already exists
    const existingRole = await RoleModel.findOne({ name: data.name });
    if (existingRole) {
      throw new ConflictError('Role with this name already exists');
    }

    // Convert Map to object if needed
    let permissions = data.permissions;
    if (permissions instanceof Map) {
      permissions = Object.fromEntries(permissions);
    }

    const role = await RoleModel.create({
      name: data.name,
      description: data.description,
      permissions: permissions || {},
      isSystemRole: data.isSystemRole || false,
      isActive: true,
    });

    return role.toObject();
  }

  /**
   * Update a role
   */
  async updateRole(
    roleId: string,
    updates: {
      name?: string;
      description?: string;
      permissions?: Map<string, boolean> | Record<string, boolean>;
      isActive?: boolean;
    }
  ): Promise<Role> {
    const role = await RoleModel.findById(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    // Prevent updating system roles (except isActive)
    if (role.isSystemRole && updates.name) {
      throw new ConflictError('Cannot update name of system role');
    }

    // Check if new name conflicts with existing role
    if (updates.name && updates.name !== role.name) {
      const existingRole = await RoleModel.findOne({ name: updates.name });
      if (existingRole) {
        throw new ConflictError('Role with this name already exists');
      }
    }

    // Convert Map to object if needed for permissions
    if (updates.permissions instanceof Map) {
      updates.permissions = Object.fromEntries(updates.permissions);
    }

    Object.assign(role, updates);
    await role.save();

    return role.toObject();
  }

  /**
   * Delete a role (soft delete by setting isActive to false)
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = await RoleModel.findById(roleId);
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    // Prevent deleting system roles
    if (role.isSystemRole) {
      throw new ConflictError('Cannot delete system role');
    }

    // Check if role is assigned to any users
    const userRolesCount = await UserRoleModel.countDocuments({ roleId });
    if (userRolesCount > 0) {
      // Soft delete by setting isActive to false
      (role as any).isActive = false;
      await role.save();
    } else {
      // Hard delete if no users have this role
      await RoleModel.findByIdAndDelete(roleId);
    }
  }

  /**
   * Get users with a specific role
   */
  async getUsersWithRole(roleId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [userRoles, total] = await Promise.all([
      UserRoleModel.find({ roleId })
        .populate('userId', 'email firstName lastName isActive')
        .sort({ assignedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserRoleModel.countDocuments({ roleId }),
    ]);

    return {
      users: userRoles.map((ur) => ({
        user: ur.userId,
        assignedAt: ur.assignedAt,
        assignedBy: ur.assignedBy,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export const roleService = new RoleService();

