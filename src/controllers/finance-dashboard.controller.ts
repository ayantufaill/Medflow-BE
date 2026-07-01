import type { Request, Response, NextFunction } from 'express';
import { financeDashboardService } from '../services/finance-dashboard.service';

export class FinanceDashboardController {
  async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      
      const result = await financeDashboardService.getLedgerByPatient(patientId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAging(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      
      const result = await financeDashboardService.getAgingByPatient(patientId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGlobalOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await financeDashboardService.getGlobalOverview();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const financeDashboardController = new FinanceDashboardController();
