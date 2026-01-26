import type { Request, Response, NextFunction } from 'express';
import { appointmentTypeService } from '../services/appointment-type.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class AppointmentTypeController {
  async getAllAppointmentTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const result = await appointmentTypeService.getAllAppointmentTypes(
        page,
        limit,
        search || undefined,
        isActive
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAppointmentTypeById(req: Request, res: Response, next: NextFunction) {
    try {
      const { appointmentTypeId } = req.params;
      
      if (!appointmentTypeId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Appointment type ID is required' },
        });
      }

      const appointmentType = await appointmentTypeService.getAppointmentTypeById(appointmentTypeId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'appointment_types', appointmentTypeId);
      }

      res.status(200).json({
        success: true,
        data: { appointmentType },
      });
    } catch (error) {
      next(error);
    }
  }

  async createAppointmentType(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const {
        name,
        description,
        defaultDuration,
        defaultPrice,
        colorCode,
        requiresAuthorization,
        bufferBefore,
        bufferAfter,
      } = req.body;

      const appointmentType = await appointmentTypeService.createAppointmentType(
        {
          name,
          description,
          defaultDuration,
          defaultPrice,
          colorCode,
          requiresAuthorization,
          bufferBefore,
          bufferAfter,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { appointmentType },
        message: 'Appointment type created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAppointmentType(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { appointmentTypeId } = req.params;
      
      if (!appointmentTypeId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Appointment type ID is required' },
        });
      }
      
      const updates = req.body;

      const appointmentType = await appointmentTypeService.updateAppointmentType(
        appointmentTypeId,
        updates,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { appointmentType },
        message: 'Appointment type updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAppointmentType(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { appointmentTypeId } = req.params;
      
      if (!appointmentTypeId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Appointment type ID is required' },
        });
      }

      await appointmentTypeService.deleteAppointmentType(appointmentTypeId, req.userId);

      res.status(200).json({
        success: true,
        message: 'Appointment type deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentTypeController = new AppointmentTypeController();
