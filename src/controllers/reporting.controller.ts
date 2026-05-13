import type { Request, Response, NextFunction } from 'express';
import { reportingService } from '../services/reporting.service';

export class ReportingController {
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
