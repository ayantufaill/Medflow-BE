import type { Request, Response, NextFunction } from 'express';
import { feeManagementService } from '../services/fee-management.service';

export class FeeManagementController {
  async getFeeSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const schedules = await feeManagementService.getFeeSchedules();
      res.status(200).json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProcedureCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await feeManagementService.getProcedureCodes({
        search,
        category,
        page,
        limit,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getProcedureFees(req: Request, res: Response, next: NextFunction) {
    try {
      const procCode = req.params.procCode as string;
      const fees = await feeManagementService.getProcedureFees(procCode);
      res.status(200).json({
        success: true,
        data: fees,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProcedureFees(req: Request, res: Response, next: NextFunction) {
    try {
      const procCode = req.params.procCode as string;
      const { fees } = req.body;

      const updated = await feeManagementService.updateProcedureFees(procCode, fees);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const feeManagementController = new FeeManagementController();
