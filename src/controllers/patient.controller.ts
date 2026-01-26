import type { Request, Response, NextFunction } from 'express';
import { patientService } from '../services/patient.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class PatientController {
  async getAllPatients(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const dobStart = req.query.dobStart as string | undefined;
      const dobEnd = req.query.dobEnd as string | undefined;

      const result = await patientService.getAllPatients(page, limit, search, status, dobStart, dobEnd);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientById(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }

      // Always return patient with SSN included
      const patient = await patientService.getPatientById(patientId);

      // Log activity
      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'patients', patientId);
      }

      res.status(200).json({
        success: true,
        data: { patient },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }
      
      const balance = await patientService.getPatientBalance(patientId);

      res.status(200).json({
        success: true,
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  }

  async searchPatients(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const dobStart = req.query.dobStart as string | undefined;
      const dobEnd = req.query.dobEnd as string | undefined;

      const result = await patientService.getAllPatients(page, limit, search, status, dobStart, dobEnd);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkDuplicates(req: Request, res: Response, next: NextFunction) {
    try {
      const { firstName, lastName, dateOfBirth, phonePrimary, email } = req.body;

      if (!firstName || !lastName || !dateOfBirth) {
        return res.status(400).json({
          success: false,
          error: { message: 'firstName, lastName, and dateOfBirth are required' },
        });
      }

      const duplicates = await patientService.findDuplicatePatients({
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        phonePrimary,
        email,
      });

      res.status(200).json({
        success: true,
        data: { duplicates },
      });
    } catch (error) {
      next(error);
    }
  }

  async createPatient(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const result = await patientService.createPatient(req.body, req.userId);
      res.status(201).json({
        success: true,
        data: { patient: result },
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePatient(req: Request, res: Response, next: NextFunction) {
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
      
      const result = await patientService.updatePatient(patientId, req.body, req.userId);
      res.status(200).json({
        success: true,
        data: { patient: result },
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePatient(req: Request, res: Response, next: NextFunction) {
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
      
      const result = await patientService.deletePatient(patientId, req.userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const patientController = new PatientController();
