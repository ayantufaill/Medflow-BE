import type { Request, Response, NextFunction } from 'express';
import { vitalSignService } from '../services/vital-sign.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class VitalSignController {
  async getAllVitalSigns(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: {
        patientId?: string;
        appointmentId?: string;
        startDate?: Date;
        endDate?: Date;
      } = {};

      if (req.query.patientId) filters.patientId = req.query.patientId as string;
      if (req.query.appointmentId) filters.appointmentId = req.query.appointmentId as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const result = await vitalSignService.getAllVitalSigns(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVitalSignById(req: Request, res: Response, next: NextFunction) {
    try {
      const vitalSignId = req.params.vitalSignId as string;

      const vitalSign = await vitalSignService.getVitalSignById(vitalSignId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'vital_signs', vitalSignId);
      }

      res.status(200).json({
        success: true,
        data: { vitalSign },
      });
    } catch (error) {
      next(error);
    }
  }

  async getVitalSignsByPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters: { startDate?: Date; endDate?: Date } = {};
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const result = await vitalSignService.getVitalSignsByPatient(patientId, page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVitalSignByAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const appointmentId = req.params.appointmentId as string;

      const vitalSign = await vitalSignService.getVitalSignByAppointment(appointmentId);

      res.status(200).json({
        success: true,
        data: { vitalSign },
      });
    } catch (error) {
      next(error);
    }
  }

  async getLatestVitalsByPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;

      const vitalSign = await vitalSignService.getLatestVitalsByPatient(patientId);

      res.status(200).json({
        success: true,
        data: { vitalSign },
      });
    } catch (error) {
      next(error);
    }
  }

  async createVitalSign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const vitalSign = await vitalSignService.createVitalSign(req.body, req.userId);

      res.status(201).json({
        success: true,
        data: { vitalSign },
        message: 'Vital signs recorded successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVitalSign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const vitalSignId = req.params.vitalSignId as string;

      const vitalSign = await vitalSignService.updateVitalSign(
        vitalSignId,
        req.body,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { vitalSign },
        message: 'Vital signs updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteVitalSign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const vitalSignId = req.params.vitalSignId as string;

      await vitalSignService.deleteVitalSign(vitalSignId, req.userId);

      res.status(200).json({
        success: true,
        message: 'Vital sign record deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getVitalsTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const days = parseInt(req.query.days as string) || 30;

      const vitals = await vitalSignService.getVitalsTrend(patientId, days);

      res.status(200).json({
        success: true,
        data: { vitals },
      });
    } catch (error) {
      next(error);
    }
  }

  async getNormalRanges(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({
        success: true,
        data: {
          temperature: { min: 95.0, max: 100.4, unit: 'F' },
          bloodPressureSystolic: { min: 90, max: 120, unit: 'mmHg' },
          bloodPressureDiastolic: { min: 60, max: 80, unit: 'mmHg' },
          heartRate: { min: 60, max: 100, unit: 'bpm' },
          oxygenSaturation: { min: 95, max: 100, unit: '%' },
          respiratoryRate: { min: 12, max: 20, unit: '/min' },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const vitalSignController = new VitalSignController();

