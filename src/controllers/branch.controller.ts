import type { Request, Response, NextFunction } from 'express';
import { branchService } from '../services/branch.service';

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
}

export const branchController = new BranchController();
