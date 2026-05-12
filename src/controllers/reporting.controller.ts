import type { Request, Response, NextFunction } from 'express';
import { reportingService } from '../services/reporting.service';

export class ReportingController {
  async getSavedReports(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reportingService.getSavedReports();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async saveReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, kind, filters, columns } = req.body;
      if (!name || !kind) {
        return res.status(400).json({ success: false, message: 'Name and Kind are required' });
      }
      const result = await reportingService.saveReport({ name, kind, filters, columns });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deleteReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportId } = req.params;
      await reportingService.deleteReport(reportId);
      res.status(200).json({ success: true, message: 'Report deleted' });
    } catch (error) {
      next(error);
    }
  }

  async runReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { kind, filters, columns, page, limit } = req.body;

      if (!kind || !filters || !columns) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: kind, filters, columns',
        });
      }

      const result = await reportingService.runReport({
        kind,
        filters,
        columns,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

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
