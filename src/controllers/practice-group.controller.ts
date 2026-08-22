import type { Request, Response, NextFunction } from 'express';
import { practiceGroupService } from '../services/practice-group.service';
import { PermissionService } from '../services/permission.service';
import { AuthorizationError } from '../utils/error.util';
import { PLATFORM_ADMIN_PERMISSIONS } from '../types/auth.types';

/**
 * Super Admin (platform:manage_practice_groups) may act on any group.
 * Group Admin may act on their own group only — resolved live via
 * getBranchAccess, not trusted from the request. Throws if neither holds.
 */
async function assertCanOperateOnGroup(userId: string, groupId: number): Promise<void> {
  const hasPlatformPermission = await PermissionService.hasPermission(
    userId,
    PLATFORM_ADMIN_PERMISSIONS.MANAGE_PRACTICE_GROUPS
  );
  if (hasPlatformPermission) return;

  const branchAccess = await PermissionService.getBranchAccess(userId);
  if (branchAccess.isGroupAdmin && branchAccess.groupId === groupId) return;

  throw new AuthorizationError('You do not have access to this practice group.');
}

export class PracticeGroupController {
  async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, config } = req.body;
      const data = await practiceGroupService.createGroup({ name, config });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getAllGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await practiceGroupService.getAllGroups();
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
