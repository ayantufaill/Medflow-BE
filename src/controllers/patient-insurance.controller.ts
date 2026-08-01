import type { Request, Response, NextFunction } from 'express';
import { patientInsuranceService } from '../services/patient-insurance.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class PatientInsuranceController {
  async getPatientInsurances(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }
      
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const insurances = await patientInsuranceService.getPatientInsurances(patientId, isActive);
      res.status(200).json({
        success: true,
        data: { insurances },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllPatientInsurances(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const insurances = await patientInsuranceService.getAllPatientInsurances(isActive);
      res.status(200).json({
        success: true,
        data: { insurances },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientInsuranceById(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientInsuranceId } = req.params;
      
      if (!patientInsuranceId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient insurance ID is required' },
        });
      }
      
      const insurance = await patientInsuranceService.getPatientInsuranceById(patientInsuranceId);

      // Log activity
      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'patient_insurance', patientInsuranceId);
      }

      res.status(200).json({
        success: true,
        data: { insurance },
      });
    } catch (error) {
      next(error);
    }
  }

  async createPatientInsurance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { patientId } = req.params;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }
      
      const insurance = await patientInsuranceService.createPatientInsurance(patientId, req.body, req.userId);
      res.status(201).json({
        success: true,
        data: { insurance },
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePatientInsurance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { patientId,patientInsuranceId } = req.params;
      
      if (!patientInsuranceId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient insurance ID is required' },
        });
      }
      
      const insurance = await patientInsuranceService.updatePatientInsurance(
         patientId,
         patientInsuranceId,
         req.body,
         req.userId
      );
      res.status(200).json({
        success: true,
        data: { insurance },
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePatientInsurance(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { patientId,patientInsuranceId } = req.params;
      
      if (!patientInsuranceId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient insurance ID is required' },
        });
      }
      
      const result = await patientInsuranceService.deletePatientInsurance(patientId,patientInsuranceId, req.userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
  async setPrimaryInsurance(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated' },
      });
    }

    const { patientId, patientInsuranceId } = req.params;

    if (!patientId || !patientInsuranceId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Patient ID and insurance ID are required' },
      });
    }

    const insurance = await patientInsuranceService.setPrimaryInsurance(
      patientId,
      patientInsuranceId
    );

    res.status(200).json({
      success: true,
      data: { insurance },
      message: 'Insurance set as primary successfully',
    });
  } catch (error) {
    next(error);
  }
}

  async reorderPatientInsurances(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { patientId } = req.params;
      const { insuranceIds } = req.body;

      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }

      const insurances = await patientInsuranceService.reorderInsurances(
        patientId,
        insuranceIds
      );

      res.status(200).json({
        success: true,
        data: { insurances },
        message: 'Insurances reordered successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const patientInsuranceController = new PatientInsuranceController();

