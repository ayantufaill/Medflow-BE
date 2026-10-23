import type { Request, Response, NextFunction } from 'express';
import { eligibilityService } from '../services/eligibility.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class EligibilityController {
  async checkEligibility(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId, patientInsuranceId } = req.params;
      const { providerId, dateOfService, serviceTypeCodes } = req.body ?? {};

      const result = await eligibilityService.checkEligibility(
        patientId,
        patientInsuranceId,
        { providerId, dateOfService, serviceTypeCodes },
        req.userId ? BigInt(req.userId) : undefined
      );

      if (req.userId) {
        await logActivityFromRequest(req, 'status_updated', 'patient_insurance', patientInsuranceId);
      }

      res.status(200).json({ success: true, data: { eligibility: result } });
    } catch (error) {
      next(error);
    }
  }

  async getLatestEligibility(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId, patientInsuranceId } = req.params;
      const eligibility = await eligibilityService.getLatestEligibility(patientId, patientInsuranceId);
      res.status(200).json({ success: true, data: { eligibility } });
    } catch (error) {
      next(error);
    }
  }
}

export const eligibilityController = new EligibilityController();
