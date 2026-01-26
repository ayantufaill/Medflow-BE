import type { Request, Response, NextFunction } from 'express';
import { roleService } from '../services/role.service';
import { PermissionService } from '../services/permission.service';

export class RoleController {
  /**
   * Get all roles
   */
  async getAllRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const search = req.query.search as string | undefined;

      const result = await roleService.getAllRoles(page, limit, search);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(req: Request, res: Response, next: NextFunction) {
    try {
      const { roleId } = req.params;
      
      if (!roleId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Role ID is required' },
        });
      }
      
      const role = await roleService.getRoleById(roleId);
      res.status(200).json({
        success: true,
        data: { role },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new role
   */
  async createRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description, permissions, isSystemRole } = req.body;

      // Convert permissions object to Map if provided
      let permissionsMap: Map<string, boolean> | undefined;
      if (permissions && typeof permissions === 'object') {
        permissionsMap = new Map(Object.entries(permissions));
      }

      const roleData: {
        name: string;
        description?: string;
        permissions?: Map<string, boolean> | Record<string, boolean>;
        isSystemRole?: boolean;
      } = {
        name,
      };
      
      if (description) roleData.description = description;
      if (permissionsMap) roleData.permissions = permissionsMap;
      if (isSystemRole !== undefined) roleData.isSystemRole = isSystemRole;

      const role = await roleService.createRole(roleData);

      res.status(201).json({
        success: true,
        data: { role },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a role
   */
  async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { roleId } = req.params;
      const { name, description, permissions, isActive } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (isActive !== undefined) updates.isActive = isActive;

      // Convert permissions object to Map if provided
      if (permissions && typeof permissions === 'object') {
        updates.permissions = new Map(Object.entries(permissions));
      }

      if (!roleId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Role ID is required' },
        });
      }
      
      const role = await roleService.updateRole(roleId, updates);
      res.status(200).json({
        success: true,
        data: { role },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { roleId } = req.params;
      
      if (!roleId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Role ID is required' },
        });
      }
      
      await roleService.deleteRole(roleId);
      res.status(200).json({
        success: true,
        data: { message: 'Role deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get users with a specific role
   */
  async getUsersWithRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { roleId } = req.params;
      
      if (!roleId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Role ID is required' },
        });
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await roleService.getUsersWithRole(roleId, page, limit);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.userId;

      if (!targetUserId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User ID required' },
        });
      }

      // Users can view their own permissions, admins can view any
      const isAdmin = req.user?.roles?.includes('Admin');
      if (!isAdmin && req.userId !== targetUserId) {
        return res.status(403).json({
          success: false,
          error: { message: 'You can only view your own permissions' },
        });
      }

      const permissions = await PermissionService.getUserPermissions(targetUserId);
      res.status(200).json({
        success: true,
        data: {
          userId: targetUserId,
          permissions: Array.from(permissions),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.userId;

      if (!targetUserId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User ID required' },
        });
      }

      // Users can view their own roles, admins can view any
      const isAdmin = req.user?.roles?.includes('Admin');
      if (!isAdmin && req.userId !== targetUserId) {
        return res.status(403).json({
          success: false,
          error: { message: 'You can only view your own roles' },
        });
      }

      const roles = await PermissionService.getUserRoles(targetUserId);
      res.status(200).json({
        success: true,
        data: {
          userId: targetUserId,
          roles,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if user has permission
   */
  async checkPermission(req: Request, res: Response, next: NextFunction) {
    try {
      const { permission, userId } = req.body;
      const targetUserId = userId || req.userId;

      if (!permission) {
        return res.status(400).json({
          success: false,
          error: { message: 'Permission is required' },
        });
      }

      if (!targetUserId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User ID required' },
        });
      }

      const hasPermission = await PermissionService.hasPermission(targetUserId, permission);
      res.status(200).json({
        success: true,
        data: {
          userId: targetUserId,
          permission,
          hasPermission,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const roleController = new RoleController();

