import { Request, Response, NextFunction } from 'express';
import { patientReferralService } from '../services/patient-referral.service';

export class PatientReferralController {
  getPatientReferrals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const patientId = req.query.patientId as string | undefined;

      const result = await patientReferralService.getPatientReferrals(patientId, page, limit);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  createPatientReferral = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await patientReferralService.createPatientReferral(req.body);

      res.status(201).json({
        success: true,
        data: { referral: result },
        message: 'Patient referral created successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}

export const patientReferralController = new PatientReferralController();
