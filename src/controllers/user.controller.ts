import type { Request, Response, NextFunction } from 'express';
import { isAdminRequest } from '../middleware/auth.middleware';
import { userService } from '../services/user.service';
import { userClinicService } from '../services/user-clinic.service';
import { logActivityFromRequest, getClientIp, getUserAgent } from '../utils/activity-logger.util';

export class UserController {
  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const roleId = req.query.roleId as string | undefined;
      const status = req.query.status as string | undefined; // 'active' or 'inactive'
      const branchId = req.query.branchId as string | undefined;

      const result = await userService.getAllUsers(page, limit, search, roleId, status, req.branchAccess?.clinicIds, branchId);
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

      // Same admin test as requireRoles('Admin'): admin group (Group/Branch Admin,
      // new-model keys included), not only a role literally named 'Admin'.
      const isAdmin = isAdminRequest(req);
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

      // Read visibility: group-wide (a sibling branch's Admin can still look
      // up a user in the same practice group), same as elsewhere in this app.
      const user = await userService.getUserById(userId, req.branchAccess?.groupClinicIds);

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

      const isAdmin = isAdminRequest(req);
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

      // Write scope: narrowed to the caller's own clinic(s), not the whole
      // group — editing another branch's user is an Admin-of-that-branch action.
      const user = await userService.updateUser(
        userId,
        updates,
        {
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        },
        req.branchAccess?.clinicIds
      );
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

      const user = await userService.assignRole(userId, roleId, assignedBy, req.branchAccess?.clinicIds);
      await logActivityFromRequest(req, 'updated', 'usergroupattach', userId, null, { roleId });
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
      
      const result = await userService.removeRole(userId, roleId, req.branchAccess?.clinicIds);
      await logActivityFromRequest(req, 'updated', 'usergroupattach', userId, { roleId }, null);
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
      
      const result = await userService.deleteUser(userId, req.userId ?? 'system', req.branchAccess?.clinicIds);
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
      
      const result = await userService.activateUser(userId, req.branchAccess?.clinicIds);
      await logActivityFromRequest(req, 'status_updated', 'user', userId, null, { status: 'active' });
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
      
      const result = await userService.deactivateUser(userId, req.branchAccess?.clinicIds);
      await logActivityFromRequest(req, 'status_updated', 'user', userId, null, { status: 'inactive' });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUserBranches(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { branchIds } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' },
        });
      }

      const result = await userService.updateUserBranches(
        userId,
        Array.isArray(branchIds) ? branchIds.map((id: string) => id.toString()) : [],
        req.branchAccess?.clinicIds
      );
      await logActivityFromRequest(req, 'updated', 'userclinic', userId, null, { branchIds });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserClinics(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ success: false, error: { message: 'User ID is required' } });
      }

      const result = await userClinicService.getUserClinics(BigInt(userId));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async setUserClinics(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { defaultId, restrictedIds, accessAll } = req.body;
      
      if (!userId) {
        return res.status(400).json({ success: false, error: { message: 'User ID is required' } });
      }

      await userClinicService.setUserClinics(
        BigInt(userId),
        { defaultId, restrictedIds: restrictedIds || [], accessAll: accessAll || false },
        req.userId!,
        req.access?.isPlatformAdmin || false,
        req.access?.roles.includes('Security Admin') || false
      );
      
      await logActivityFromRequest(req, 'updated', 'userclinic', userId, null, { defaultId, restrictedIds, accessAll });
      res.status(200).json({ success: true, data: { message: 'Clinic assignments updated successfully' } });
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

      await userService.assignUserRoles(userId, finalRoleIds, req.branchAccess?.clinicIds);

      res.status(200).json({
        success: true,
        data: { message: 'User roles updated successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * New 8(+1)-role model elevation — PATCH /users/:userId/role.
   * Deliberately separate from assignUserRoles above (which full-replaces
   * every legacy role a user holds) — see role-elevation.service.ts.
   */
  async elevateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { roleSlug, branchId } = req.body;

      if (!req.userId) {
        return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
      }
      if (!userId || typeof roleSlug !== 'string' || !roleSlug.trim()) {
        return res.status(400).json({ success: false, error: { message: 'userId and roleSlug are required' } });
      }

      const { elevateUserRole } = await import('../services/role-elevation.service');
      const result = await elevateUserRole({
        actorUserId: req.userId,
        targetUserId: userId,
        roleKey: roleSlug,
        clinicId: branchId !== undefined && branchId !== null ? BigInt(branchId) : undefined,
      });

      await logActivityFromRequest(
        req,
        'updated',
        'usergroupattach',
        userId,
        { roleKey: result.oldRoleKey },
        { roleKey: result.newRoleKey }
      );

      res.status(200).json({
        success: true,
        data: {
          message: `Role changed to "${result.newRoleKey}". The user will be signed out of all active sessions.`,
          oldRole: result.oldRoleKey,
          newRole: result.newRoleKey,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
