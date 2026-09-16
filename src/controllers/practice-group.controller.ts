import type { Request, Response, NextFunction } from 'express';
import { practiceGroupService } from '../services/practice-group.service';
import { PermissionService } from '../services/permission.service';
import { AuthorizationError } from '../utils/error.util';
import { PLATFORM_ADMIN_PERMISSIONS } from '../types/auth.types';

async function assertIsSuperAdmin(userId: string): Promise<void> {
  const roles = await PermissionService.getUserRoles(userId);
  if (roles.includes('Super Admin')) return;

  const permissions = await PermissionService.getUserPermissions(userId);
  if (permissions.has(PLATFORM_ADMIN_PERMISSIONS.MANAGE_PRACTICE_GROUPS)) return;

  throw new AuthorizationError('Only Super Admin can create practice groups.');
}

/**
 * Super Admin (platform:manage_practice_groups) may act on any group.
 * Group Admin may act on their own group only — resolved live via
 * getBranchAccess, not trusted from the request. Throws if neither holds.
 */
async function assertCanOperateOnGroup(userId: string, groupId: number): Promise<void> {
  const roles = await PermissionService.getUserRoles(userId);
  if (roles.includes('Super Admin')) return;

  const permissions = await PermissionService.getUserPermissions(userId);
  const hasPlatformPermission = permissions.has(PLATFORM_ADMIN_PERMISSIONS.MANAGE_PRACTICE_GROUPS);
  if (hasPlatformPermission) return;

  const branchAccess = await PermissionService.getBranchAccess(userId);
  if (branchAccess.isGroupAdmin && branchAccess.groupId === groupId) return;

  throw new AuthorizationError('You do not have access to this practice group.');
}

export class PracticeGroupController {
  async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      await assertIsSuperAdmin(req.userId!);
      const { name, config } = req.body;
      const data = await practiceGroupService.createGroup({ name, config });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getAllGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await PermissionService.getUserRoles(req.userId!);
      const permissions = await PermissionService.getUserPermissions(req.userId!);
      const isSuperAdmin =
        roles.includes('Super Admin') ||
        permissions.has(PLATFORM_ADMIN_PERMISSIONS.MANAGE_PRACTICE_GROUPS);

      if (isSuperAdmin) {
        const data = await practiceGroupService.getAllGroups();
        return res.status(200).json({ success: true, data });
      }

      // Group Admin or other roles: scope to their practice group and accessible branches
      const branchAccess = await PermissionService.getBranchAccess(req.userId!);
      if (!branchAccess.groupId) {
        return res.status(200).json({ success: true, data: [] });
      }

      const data = await practiceGroupService.getAllGroups({
        groupId: branchAccess.groupId,
        clinicIds: branchAccess.clinicIds,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getGroupById(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      await assertCanOperateOnGroup(req.userId!, groupId);
      const data = await practiceGroupService.getGroupById(groupId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      await assertCanOperateOnGroup(req.userId!, groupId);
      const { name, isActive } = req.body;
      const data = await practiceGroupService.updateGroup(groupId, { name, isActive });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getGroupUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      await assertCanOperateOnGroup(req.userId!, groupId);
      const data = await practiceGroupService.getGroupUsers(groupId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      await assertCanOperateOnGroup(req.userId!, groupId);
      const { name, address, city, state, zip, phone } = req.body;
      const data = await practiceGroupService.createBranch(groupId, { name, address, city, state, zip, phone });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createGroupAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      await assertCanOperateOnGroup(req.userId!, groupId);
      const { email, firstName, lastName, clinicId } = req.body;
      const data = await practiceGroupService.createGroupAdmin(
        groupId,
        { email, firstName, lastName, clinicId },
        req.userId!
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const practiceGroupController = new PracticeGroupController();
