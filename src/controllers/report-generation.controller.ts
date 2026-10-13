import type { Request, Response, NextFunction } from 'express';
import { reportGenerationService } from '../services/report-generation.service';
import { resetRecarePatient } from '../services/recare-reporting.service';

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

  async resetRecarePatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId || req.body.patientId || req.body.id;
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }
      const { note, contactAgain, followUp } = req.body;
      const data = await resetRecarePatient(patientId, { note, contactAgain, followUp });
      res.status(200).json({
        success: true,
        message: 'Recare reminders reset and details saved successfully',
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
