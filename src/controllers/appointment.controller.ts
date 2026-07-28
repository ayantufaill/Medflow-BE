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
      
      const view = (req.query.view as 'day' | 'week' | 'month') || 'week';
      const date = req.query.date as string | undefined;
      let startDate = req.query.startDate as string | undefined;
      let endDate = req.query.endDate as string | undefined;

      if ((!startDate || !endDate) && date) {
        const baseDate = new Date(date);
        if (Number.isNaN(baseDate.getTime())) {
          return res.status(400).json({
            success: false,
            error: { message: 'date must be a valid date' },
          });
        }

        const start = new Date(baseDate);
        const end = new Date(baseDate);

        if (view === 'day') {
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
        } else if (view === 'week') {
          const day = start.getDay();
          start.setDate(start.getDate() - day);
          start.setHours(0, 0, 0, 0);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
        } else {
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          end.setMonth(end.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
        }

        startDate = start.toISOString();
        endDate = end.toISOString();
      }

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: { message: 'Provide either date or both startDate and endDate' },
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
        status,
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
          status,
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
        req.userId,
        cancellationReason
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

  async getAppointmentWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const result = await appointmentService.getAppointmentWorkspace(appointmentId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAppointmentWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const result = await appointmentService.updateAppointmentWorkspace(
        appointmentId,
        req.body,
        req.userId
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAppointmentProcedures(req: Request, res: Response, next: NextFunction) {
    try {
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const result = await appointmentService.getAppointmentProcedures(appointmentId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async addAppointmentProcedure(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const result = await appointmentService.addAppointmentProcedure(
        appointmentId,
        req.body,
        req.userId
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAppointmentTags(req: Request, res: Response, next: NextFunction) {
    try {
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const result = await appointmentService.getAppointmentTags(appointmentId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async addAppointmentTag(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const result = await appointmentService.addAppointmentTag(appointmentId, req.body, req.userId);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async addAppointmentLabOrder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const result = await appointmentService.addAppointmentLabOrder(
        appointmentId,
        req.body,
        req.userId
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkOutAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const appointment = await appointmentService.checkOutAppointment(appointmentId, req.userId);
      res.status(200).json({
        success: true,
        data: { appointment },
        message: 'Patient checked out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async createAppointmentCommunication(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const result = await appointmentService.createAppointmentCommunication(
        appointmentId,
        req.body,
        req.userId
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async sendAppointmentConfirmationNotification(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ success: false, error: { message: 'Appointment ID is required' } });
      }
      const channels = req.body.channels ?? ['email', 'sms'];
      const result = await appointmentService.sendAppointmentConfirmationNotification(
        appointmentId,
        channels,
        req.userId
      );
      res.status(200).json({
        success: true,
        data: result,
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

  async getPatientAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Patient ID is required' },
      });
    }
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await appointmentService.getPatientAppointments(patientId, limit);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
}

export const appointmentController = new AppointmentController();
