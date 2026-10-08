import type { Request, Response, NextFunction } from 'express';
import { reportGenerationService } from '../services/report-generation.service';

export class ReportGenerationController {
  async getFinancialReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportName } = req.params;
      const data = await reportGenerationService.getFinancialReport(reportName, { ...req.query, branchId: req.query.branchId || req.header('x-branch-id') });
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getClinicalReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportName } = req.params;
      const data = await reportGenerationService.getClinicalReport(reportName, { ...req.query, branchId: req.query.branchId || req.header('x-branch-id') });
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportName } = req.params;
      const data = await reportGenerationService.getPatientReport(reportName, { ...req.query, branchId: req.query.branchId || req.header('x-branch-id') });
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOthersReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportName } = req.params;
      const data = await reportGenerationService.getOthersReport(reportName, { ...req.query, branchId: req.query.branchId || req.header('x-branch-id') });
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reportGenerationController = new ReportGenerationController();
