import type { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { logActivityFromRequest, getClientIp, getUserAgent } from '../utils/activity-logger.util';

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
      
      const result = await userService.getUserActivity(userId, page, limit);
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
      
      const result = await userService.getUserLoginHistory(userId, page, limit);
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
      const { email, firstName, lastName, phone, preferredLanguage, roleIds, roleId } = req.body;

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
        phone?: string;
        preferredLanguage?: string;
        roleIds?: string[];
      } = {
        email,
        firstName,
        lastName,
      };
      
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
      const { roleIds } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }

      if (!Array.isArray(roleIds)) {
        return res.status(400).json({
          success: false,
          error: { message: 'roleIds must be an array of strings' },
        });
      }

      await userService.assignUserRoles(userId, roleIds);

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
