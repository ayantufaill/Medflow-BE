import type { Request, Response, NextFunction } from 'express';
import { branchService } from '../services/branch.service';
import { AuthorizationError, ValidationError } from '../utils/error.util';
import { getNewModelRoleForUser } from '../services/rbac.service';
import { PermissionService } from '../services/permission.service';

export class BranchController {
  async getBranches(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicIds = req.branchAccess?.clinicIds ?? [];
      const data = await branchService.getBranches(clinicIds);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getBranchAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicIds = req.branchAccess?.clinicIds ?? [];
      const branchId = req.query.branchId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const data = await branchService.getBranchAnalytics({ clinicIds, branchId, startDate, endDate });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /branches/:branchId/features — group_admin (or a legacy wildcard
   * admin) only. Toggling a flag here has immediate effect: rbac.service.ts
   * reads clinic.features live, no session invalidation needed.
   */
  async updateFeatures(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
      }
      const { branchId } = req.params;
      const { treatment_coordinator } = req.body;
      if (treatment_coordinator === undefined || typeof treatment_coordinator !== 'boolean') {
        throw new ValidationError('treatment_coordinator (boolean) is required.');
      }

      const [permissions, newModelRole] = await Promise.all([
        PermissionService.getUserPermissions(req.userId),
        getNewModelRoleForUser(req.userId),
      ]);
      const isAuthorized = permissions.has('*') || newModelRole?.roleKey === 'group_admin';
      if (!isAuthorized) {
        throw new AuthorizationError('Only group_admin can change branch feature flags.');
      }

      const clinicId = BigInt(branchId);
      const clinicIds = req.branchAccess?.clinicIds ?? [];
      if (!permissions.has('*') && !clinicIds.includes(clinicId)) {
        throw new AuthorizationError('This branch is outside your group.');
      }

      const features = await branchService.updateFeatures(clinicId, { treatment_coordinator });
      res.status(200).json({ success: true, data: { features } });
    } catch (error) {
      next(error);
    }
  }
}

export const branchController = new BranchController();
