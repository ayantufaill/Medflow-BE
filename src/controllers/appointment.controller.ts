import type { Request, Response, NextFunction } from 'express';
import { appointmentService } from '../services/appointment.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class AppointmentController {
  async getAllAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const providerId = req.query.providerId as string | undefined;
      const patientId = req.query.patientId as string | undefined;
      const status = req.query.status as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const appointmentTypeId = req.query.appointmentTypeId as string | undefined;
      const search = req.query.search as string | undefined;

      // Build filters object, only including defined values
      const filters: {
        providerId?: string;
        patientId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        appointmentTypeId?: string;
        search?: string;
      } = {};
      
      if (providerId) filters.providerId = providerId;
      if (patientId) filters.patientId = patientId;
      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (appointmentTypeId) filters.appointmentTypeId = appointmentTypeId;
      if (search) filters.search = search;

      const result = await appointmentService.getAllAppointments(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAppointmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { appointmentId } = req.params;
      
      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Appointment ID is required' },
        });
      }

      const appointment = await appointmentService.getAppointmentById(appointmentId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'appointments', appointmentId);
      }

      res.status(200).json({
        success: true,
        data: { appointment },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProviderSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerId } = req.params;
      
      if (!providerId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Provider ID is required' },
        });
      }
      
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const view = (req.query.view as 'day' | 'week' | 'month') || 'week';

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: { message: 'startDate and endDate are required' },
        });
      }

      const result = await appointmentService.getProviderSchedule(
        providerId,
        new Date(startDate),
        new Date(endDate),
        view
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCalendarSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const providerIds = req.query.providerIds as string | undefined;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: { message: 'startDate and endDate are required' },
        });
      }

      const providerIdArray = providerIds ? providerIds.split(',').filter(id => id.trim()) : undefined;

      const result = await appointmentService.getCalendarSchedule(
        new Date(startDate),
        new Date(endDate),
        providerIdArray
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerId } = req.params;
      
      if (!providerId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Provider ID is required' },
        });
      }
      
      const date = req.query.date as string;
      const durationMinutes = parseInt(req.query.durationMinutes as string) || 30;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: { message: 'date is required' },
        });
      }

      const result = await appointmentService.getAvailableSlots(
        providerId,
        new Date(date),
        durationMinutes
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const {
        patientId,
        providerId,
        appointmentTypeId,
        appointmentDate,
        startTime,
        endTime,
        durationMinutes,
        chiefComplaint,
        notes,
        roomId,
        requiresInterpreter,
        interpreterLanguage,
        insuranceVerified,
        copayCollected,
        reminderSent,
        customFields,
      } = req.body;

      const appointment = await appointmentService.createAppointment(
        {
          patientId,
          providerId,
          appointmentTypeId,
          appointmentDate: new Date(appointmentDate),
          startTime,
          endTime,
          durationMinutes,
          chiefComplaint,
          notes,
          roomId,
          requiresInterpreter,
          interpreterLanguage,
          insuranceVerified,
          copayCollected,
          reminderSent,
          customFields,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { appointment },
        message: 'Appointment created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { appointmentId } = req.params;
      
      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Appointment ID is required' },
        });
      }
      
      const updates = req.body;

      const appointment = await appointmentService.updateAppointment(
        appointmentId,
        updates,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { appointment },
        message: 'Appointment updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { appointmentId } = req.params;
      
      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Appointment ID is required' },
        });
      }
      
      const { cancellationReason } = req.body;

      const appointment = await appointmentService.cancelAppointment(
        appointmentId,
        cancellationReason,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { appointment },
        message: 'Appointment cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async rescheduleAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { appointmentId } = req.params;
      
      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Appointment ID is required' },
        });
      }
      
      const { appointmentDate, startTime, endTime } = req.body;

      if (!appointmentDate || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          error: { message: 'appointmentDate, startTime, and endTime are required' },
        });
      }

      const appointment = await appointmentService.rescheduleAppointment(
        appointmentId,
        new Date(appointmentDate),
        startTime,
        endTime,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { appointment },
        message: 'Appointment rescheduled successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async checkInAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { appointmentId } = req.params;
      
      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Appointment ID is required' },
        });
      }

      const appointment = await appointmentService.checkInAppointment(appointmentId, req.userId);

      res.status(200).json({
        success: true,
        data: { appointment },
        message: 'Patient checked in successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { appointmentId } = req.params;
      
      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Appointment ID is required' },
        });
      }

      await appointmentService.deleteAppointment(appointmentId, req.userId);

      res.status(200).json({
        success: true,
        message: 'Appointment deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentController = new AppointmentController();
