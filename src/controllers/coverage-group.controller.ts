import { Request, Response, NextFunction } from 'express';
import { coverageGroupService } from '../services/coverage-group.service';

export class CoverageGroupController {
  async createCoverageGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await coverageGroupService.createCoverageGroup(req.body, req.userId);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCoverageGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.query.patientId as string | undefined;
      const planId = req.query.planId as string | undefined;
      const groups = await coverageGroupService.getCoverageGroups({ patientId, planId });
      res.status(200).json({
        success: true,
        data: { groups },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCoverageGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = req.params.groupId as string;
      const result = await coverageGroupService.deleteCoverageGroup(groupId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const coverageGroupController = new CoverageGroupController();
