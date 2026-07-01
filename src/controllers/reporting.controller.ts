import type { Request, Response, NextFunction } from 'express';
import { reportingService } from '../services/reporting.service';

export class ReportingController {
  async getSavedReports(req: Request, res: Response, next: NextFunction) {
    try {
      const reports = await reportingService.getSavedReports();
      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      next(error);
    }
  }

  async saveReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await reportingService.saveReport(req.body, req.userId);
      res.status(201).json({
        success: true,
        data: report,
        message: 'Report definition saved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportId } = req.params;
      const result = await reportingService.deleteReport(reportId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Report definition deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async runReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reportingService.runReport(req.body);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async archiveReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, data } = req.body;
      const result = await reportingService.archiveReport(type, data, req.userId);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Report snapshot archived successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getArchivedReports(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reportingService.getArchivedReports();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getArchivedReportById(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportId } = req.params;
      const result = await reportingService.getArchivedReportById(reportId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reportingController = new ReportingController();
