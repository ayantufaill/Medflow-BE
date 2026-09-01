import { Request, Response, NextFunction } from 'express';
import { patientReportService } from '../services/patient-report.service';

export class PatientReportController {
  getPatientReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId } = req.params;
      const { appointmentId } = req.query;
      const report = await patientReportService.getReport(
        patientId,
        appointmentId as string | undefined
      );
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  };
}

export const patientReportController = new PatientReportController();
