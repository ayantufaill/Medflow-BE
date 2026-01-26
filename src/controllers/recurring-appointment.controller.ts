import type { Request, Response, NextFunction } from 'express';
import { recurringAppointmentService } from '../services/recurring-appointment.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class RecurringAppointmentController {
  async getAllRecurringAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const patientId = req.query.patientId as string | undefined;
      const providerId = req.query.providerId as string | undefined;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const search = req.query.search ? decodeURIComponent(req.query.search as string) : undefined;
      const startDateFrom = req.query.startDateFrom as string | undefined;
      const startDateTo = req.query.startDateTo as string | undefined;

      const filters: {
        patientId?: string;
        providerId?: string;
        isActive?: boolean;
        search?: string;
        startDateFrom?: string;
        startDateTo?: string;
      } = {};
      
      if (patientId) filters.patientId = patientId;
      if (providerId) filters.providerId = providerId;
      if (isActive !== undefined) filters.isActive = isActive;
      if (search) filters.search = search;
      if (startDateFrom) filters.startDateFrom = startDateFrom;
      if (startDateTo) filters.startDateTo = startDateTo;

      const result = await recurringAppointmentService.getAllRecurringAppointments(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecurringAppointmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { recurringAppointmentId } = req.params;
      
      if (!recurringAppointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Recurring appointment ID is required' },
        });
      }

      const recurringAppointment = await recurringAppointmentService.getRecurringAppointmentById(
        recurringAppointmentId
      );

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'recurring_appointments', recurringAppointmentId);
      }

      res.status(200).json({
        success: true,
        data: { recurringAppointment },
      });
    } catch (error) {
      next(error);
    }
  }

  async previewRecurringAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        providerId,
        appointmentTypeId,
        frequency,
        frequencyValue,
        startDate,
        endDate,
        preferredTime,
        preferredDayOfWeek,
        totalAppointments,
      } = req.body;

      const previewData: {
        providerId: string;
        appointmentTypeId?: string;
        frequency: "weekly" | "monthly" | "quarterly";
        frequencyValue: number;
        startDate: Date;
        endDate?: Date;
        preferredTime: string;
        preferredDayOfWeek?: number;
        totalAppointments?: number;
      } = {
        providerId,
        frequency,
        frequencyValue,
        startDate: new Date(startDate),
        preferredTime,
      };
      
      if (appointmentTypeId) previewData.appointmentTypeId = appointmentTypeId;
      if (endDate) previewData.endDate = new Date(endDate);
      if (preferredDayOfWeek !== undefined) previewData.preferredDayOfWeek = preferredDayOfWeek;
      if (totalAppointments !== undefined) previewData.totalAppointments = totalAppointments;

      const preview = await recurringAppointmentService.previewRecurringAppointments(previewData);

      res.status(200).json({
        success: true,
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }

  async createRecurringAppointment(req: Request, res: Response, next: NextFunction) {
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
        frequency,
        frequencyValue,
        startDate,
        endDate,
        preferredTime,
        preferredDayOfWeek,
        totalAppointments,
      } = req.body;

      const createData: {
        patientId: string;
        providerId: string;
        appointmentTypeId?: string;
        frequency: "weekly" | "monthly" | "quarterly";
        frequencyValue: number;
        startDate: Date;
        endDate?: Date;
        preferredTime: string;
        preferredDayOfWeek?: number;
        totalAppointments?: number;
      } = {
        patientId,
        providerId,
        frequency,
        frequencyValue,
        startDate: new Date(startDate),
        preferredTime,
      };
      
      if (appointmentTypeId) createData.appointmentTypeId = appointmentTypeId;
      if (endDate) createData.endDate = new Date(endDate);
      if (preferredDayOfWeek !== undefined) createData.preferredDayOfWeek = preferredDayOfWeek;
      if (totalAppointments !== undefined) createData.totalAppointments = totalAppointments;

      const result = await recurringAppointmentService.createRecurringAppointment(
        createData,
        req.userId
      );

      // result can be the recurring appointment or an object with recurringAppointment and generated info
      const recurringAppointment = (result as any).recurringAppointment || result;
      const generatedInfo = (result as any).appointmentsCreated !== undefined ? {
        appointmentsCreated: (result as any).appointmentsCreated,
        skippedCount: (result as any).skippedCount || 0,
      } : undefined;

      let message = 'Recurring appointment series created successfully';
      if (generatedInfo) {
        message += `. ${generatedInfo.appointmentsCreated} appointment(s) generated`;
        if (generatedInfo.skippedCount > 0) {
          message += `, ${generatedInfo.skippedCount} skipped due to conflicts`;
        }
      }

      res.status(201).json({
        success: true,
        data: { 
          recurringAppointment,
          ...(generatedInfo && { generatedInfo })
        },
        message,
      });
    } catch (error) {
      next(error);
    }
  }

  async generateAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { recurringAppointmentId } = req.params;
      
      if (!recurringAppointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Recurring appointment ID is required' },
        });
      }
      
      const { count } = req.body;

      if (!count || count < 1) {
        return res.status(400).json({
          success: false,
          error: { message: 'count must be a positive integer' },
        });
      }

      const result = await recurringAppointmentService.generateAppointments(
        recurringAppointmentId,
        count,
        req.userId
      );

      const message = result.skippedCount > 0
        ? `${result.appointments.length} appointment(s) generated successfully. ${result.skippedCount} appointment(s) skipped due to conflicts.`
        : `${result.appointments.length} appointment(s) generated successfully`;

      res.status(200).json({
        success: true,
        data: {
          appointments: result.appointments,
          count: result.appointments.length,
          skippedCount: result.skippedCount,
          skippedAppointments: result.skippedAppointments,
        },
        message,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRecurringAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { recurringAppointmentId } = req.params;
      
      if (!recurringAppointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Recurring appointment ID is required' },
        });
      }
      
      const updates = req.body;

      if (updates.startDate) {
        updates.startDate = new Date(updates.startDate);
      }
      if (updates.endDate) {
        updates.endDate = new Date(updates.endDate);
      }

      const recurringAppointment = await recurringAppointmentService.updateRecurringAppointment(
        recurringAppointmentId,
        updates,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { recurringAppointment },
        message: 'Recurring appointment updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRecurringAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { recurringAppointmentId } = req.params;
      
      if (!recurringAppointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Recurring appointment ID is required' },
        });
      }

      const result = await recurringAppointmentService.deleteRecurringAppointment(recurringAppointmentId, req.userId);

      let message = 'Recurring appointment deleted successfully';
      if (result.deletedAppointmentsCount > 0) {
        message += `. ${result.deletedAppointmentsCount} associated appointment(s) also deleted.`;
      }

      res.status(200).json({
        success: true,
        message,
        data: { deletedAppointmentsCount: result.deletedAppointmentsCount },
      });
    } catch (error) {
      next(error);
    }
  }

  async createRecurringAppointmentWithResolution(req: Request, res: Response, next: NextFunction) {
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
        frequency,
        frequencyValue,
        startDate,
        endDate,
        preferredTime,
        preferredDayOfWeek,
        totalAppointments,
        appointmentOverrides,
      } = req.body;

      const createData: {
        patientId: string;
        providerId: string;
        appointmentTypeId?: string;
        frequency: "weekly" | "monthly" | "quarterly";
        frequencyValue: number;
        startDate: Date;
        endDate?: Date;
        preferredTime: string;
        preferredDayOfWeek?: number;
        totalAppointments?: number;
        appointmentOverrides?: { dayOfWeek: number; skip?: boolean; customDate?: string; customStartTime?: string; customEndTime?: string; }[];
      } = {
        patientId,
        providerId,
        frequency,
        frequencyValue,
        startDate: new Date(startDate),
        preferredTime,
      };
      
      if (appointmentTypeId !== undefined && appointmentTypeId !== null) {
        (createData as any).appointmentTypeId = appointmentTypeId;
      }
      if (endDate !== undefined && endDate !== null) {
        (createData as any).endDate = new Date(endDate);
      }
      if (preferredDayOfWeek !== undefined && preferredDayOfWeek !== null) {
        (createData as any).preferredDayOfWeek = preferredDayOfWeek;
      }
      if (totalAppointments !== undefined && totalAppointments !== null) {
        (createData as any).totalAppointments = totalAppointments;
      }
      if (appointmentOverrides !== undefined && appointmentOverrides !== null) {
        (createData as any).appointmentOverrides = appointmentOverrides;
      }

      const result = await recurringAppointmentService.createRecurringAppointmentWithResolution(
        createData as any,
        req.userId
      );

      let message = 'Recurring appointment series created successfully';
      message += `. ${result.appointmentsCreated} appointment(s) created`;
      if (result.skippedCount > 0) {
        message += `, ${result.skippedCount} skipped`;
      }

      res.status(201).json({
        success: true,
        data: {
          recurringAppointment: result.recurringAppointment,
          appointmentsCreated: result.appointmentsCreated,
          skippedCount: result.skippedCount,
          skippedAppointments: result.skippedAppointments,
        },
        message,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLinkedAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const { recurringAppointmentId } = req.params;
      
      if (!recurringAppointmentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Recurring appointment ID is required' },
        });
      }

      const appointments = await recurringAppointmentService.getLinkedAppointments(recurringAppointmentId);

      res.status(200).json({
        success: true,
        data: { appointments, count: appointments.length },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const recurringAppointmentController = new RecurringAppointmentController();
