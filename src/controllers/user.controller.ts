import type { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { logActivityFromRequest, getClientIp, getUserAgent } from '../utils/activity-logger.util';
import { PermissionService } from '../services/permission.service';
import { GROUP_ADMIN_PERMISSIONS } from '../types/auth.types';

export class UserController {
  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const roleId = req.query.roleId as string | undefined;
      const status = req.query.status as string | undefined; // 'active' or 'inactive'

      const result = await userService.getAllUsers(page, limit, search, roleId, status);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsersByRoleName(req: Request, res: Response, next: NextFunction) {
    try {
      const { roleName } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const status = req.query.status as string | undefined;
      const excludeWithProvider = req.query.excludeWithProvider === 'true';

      if (!roleName) {
        return res.status(400).json({
          success: false,
          error: { message: 'Role name is required' },
        });
      }
      
      const result = await userService.getUsersByRoleName(roleName, page, limit, status || undefined, excludeWithProvider);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      // Users can only view their own profile unless they're an admin
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const isAdmin = req.user.roles?.includes('Admin');
      if (!isAdmin && req.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: { message: 'You can only view your own profile' },
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }
      
      const user = await userService.getUserById(userId);

      // Log user view activity
      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'users', userId);
      }

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      // Users can only update themselves unless they're an admin
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const isAdmin = req.user.roles?.includes('Admin');
      if (!isAdmin && req.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: { message: 'You can only update your own profile' },
        });
      }

      // Remove isActive from updates if user is not admin
      const updates = { ...req.body };
      if (!isAdmin) {
        delete updates.isActive;
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }
      
      const user = await userService.updateUser(userId, updates, {
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCurrentBranch(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { branchId } = req.body;
      const data = await userService.updateCurrentBranch(req.userId, branchId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** Reassigns an existing user's branch(es) — Super Admin, Group Admin (own group), or Branch Admin (own branch). */
  async updateUserBranches(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { userId } = req.params;
      const { branchIds } = req.body;

      const currentBranchIds = await PermissionService.getAssignedBranchIds(userId);
      await PermissionService.assertCanManageBranchAssignment(
        req.userId,
        currentBranchIds,
        branchIds,
        GROUP_ADMIN_PERMISSIONS.MANAGE_USERS
      );

      const data = await userService.updateUserBranches(userId, branchIds);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const updates = req.body;
      const user = await userService.updateUser(req.userId, updates, {
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { currentPassword, newPassword } = req.body;
      const result = await userService.changePassword(req.userId, currentPassword, newPassword);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async assignRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }
      
      const { roleId } = req.body;
      const assignedBy = req.userId || 'system';

      const user = await userService.assignRole(userId, roleId, assignedBy);
      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async removeRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, roleId } = req.params;
      
      if (!userId || !roleId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID and Role ID are required' },
        });
      }
      
      const result = await userService.removeRole(userId, roleId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }
      
      const result = await userService.deleteUser(userId, req.userId ?? 'system');
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async activateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }
      
      const result = await userService.activateUser(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }
      
      const result = await userService.deactivateUser(userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }
      
      const result = await userService.getUserActivity(userId, page, limit, search, startDate, endDate);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserLoginHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }
      
      const result = await userService.getUserLoginHistory(userId, page, limit, search, startDate, endDate);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, firstName, lastName, password, isActive, phone, preferredLanguage, roleIds, roleId } = req.body;

      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const userData: {
        email: string;
        firstName: string;
        lastName: string;
        password?: string;
        isActive?: boolean;
        phone?: string;
        preferredLanguage?: string;
        roleIds?: string[];
      } = {
        email,
        firstName,
        lastName,
      };
      
      if (password) userData.password = password;
      if (typeof isActive === 'boolean') userData.isActive = isActive;
      if (phone) userData.phone = phone;
      if (preferredLanguage) userData.preferredLanguage = preferredLanguage;
      const normalizedRoleIds: string[] = [];
      if (roleId) {
        normalizedRoleIds.push(roleId);
      }
      if (roleIds) {
        normalizedRoleIds.push(...(Array.isArray(roleIds) ? roleIds : [roleIds]));
      }

      if (normalizedRoleIds.length > 0) {
        userData.roleIds = Array.from(new Set(normalizedRoleIds.map(String)));
      }

      const result = await userService.createUser(
        userData,
        req.userId
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async assignUserRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { roleIds, roleId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }

      let finalRoleIds: string[] = [];
      if (Array.isArray(roleIds)) {
        finalRoleIds = roleIds.map(String);
      } else if (roleId !== undefined && roleId !== null) {
        finalRoleIds = [String(roleId)];
      } else {
        return res.status(400).json({
          success: false,
          error: { message: 'roleIds must be an array or roleId must be provided' },
        });
      }

      await userService.assignUserRoles(userId, finalRoleIds);

      res.status(200).json({
        success: true,
        data: { message: 'User roles updated successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
