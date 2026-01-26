import type { Request, Response, NextFunction } from 'express';
import { waitlistService } from '../services/waitlist.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class WaitlistController {
  async getAllWaitlistEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const patientId = req.query.patientId as string | undefined;
      const providerId = req.query.providerId as string | undefined;
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;
      const search = req.query.search as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      const filters: {
        patientId?: string;
        providerId?: string;
        status?: string;
        priority?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
      } = {};
      
      if (patientId) filters.patientId = patientId;
      if (providerId) filters.providerId = providerId;
      if (status) filters.status = status;
      if (priority) filters.priority = priority;
      if (search) filters.search = search;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const result = await waitlistService.getAllWaitlistEntries(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getWaitlistEntryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { waitlistEntryId } = req.params;
      
      if (!waitlistEntryId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Waitlist entry ID is required' },
        });
      }

      const waitlistEntry = await waitlistService.getWaitlistEntryById(waitlistEntryId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'waitlist', waitlistEntryId);
      }

      res.status(200).json({
        success: true,
        data: { waitlistEntry },
      });
    } catch (error) {
      next(error);
    }
  }

  async createWaitlistEntry(req: Request, res: Response, next: NextFunction) {
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
        preferredDate,
        preferredTimeStart,
        preferredTimeEnd,
        priority,
        notes,
      } = req.body;

      const entryData: {
        patientId: string;
        providerId: string;
        appointmentTypeId?: string;
        preferredDate?: Date;
        preferredTimeStart?: string;
        preferredTimeEnd?: string;
        priority?: "urgent" | "normal" | "flexible";
        notes?: string;
      } = {
        patientId,
        providerId,
      };
      
      if (appointmentTypeId) entryData.appointmentTypeId = appointmentTypeId;
      if (preferredDate) entryData.preferredDate = new Date(preferredDate);
      if (preferredTimeStart) entryData.preferredTimeStart = preferredTimeStart;
      if (preferredTimeEnd) entryData.preferredTimeEnd = preferredTimeEnd;
      if (priority) entryData.priority = priority;
      if (notes) entryData.notes = notes;

      const waitlistEntry = await waitlistService.createWaitlistEntry(
        entryData,
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { waitlistEntry },
        message: 'Waitlist entry created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateWaitlistEntry(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { waitlistEntryId } = req.params;
      
      if (!waitlistEntryId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Waitlist entry ID is required' },
        });
      }
      
      const updates = req.body;

      if (updates.preferredDate) {
        updates.preferredDate = new Date(updates.preferredDate);
      }

      const waitlistEntry = await waitlistService.updateWaitlistEntry(
        waitlistEntryId,
        updates,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { waitlistEntry },
        message: 'Waitlist entry updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsCalled(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { waitlistEntryId } = req.params;
      
      if (!waitlistEntryId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Waitlist entry ID is required' },
        });
      }

      const waitlistEntry = await waitlistService.markAsCalled(waitlistEntryId, req.userId);

      res.status(200).json({
        success: true,
        data: { waitlistEntry },
        message: 'Waitlist entry marked as called',
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { waitlistEntryId } = req.params;
      
      if (!waitlistEntryId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Waitlist entry ID is required' },
        });
      }

      const waitlistEntry = await waitlistService.markAsScheduled(waitlistEntryId, req.userId);

      res.status(200).json({
        success: true,
        data: { waitlistEntry },
        message: 'Waitlist entry marked as scheduled',
      });
    } catch (error) {
      next(error);
    }
  }

  async convertToAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { waitlistEntryId } = req.params;
      
      if (!waitlistEntryId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Waitlist entry ID is required' },
        });
      }
      
      const {
        appointmentDate,
        startTime,
        endTime,
        durationMinutes,
        notes,
        roomId,
        chiefComplaint,
      } = req.body;

      if (!appointmentDate || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'appointmentDate, startTime, and endTime are required',
          },
        });
      }

      const appointmentData: {
        appointmentDate: Date;
        startTime: string;
        endTime: string;
        durationMinutes?: number;
        notes?: string;
        roomId?: string;
        chiefComplaint?: string;
      } = {
        appointmentDate: new Date(appointmentDate),
        startTime,
        endTime,
      };
      
      if (durationMinutes !== undefined) appointmentData.durationMinutes = durationMinutes;
      if (notes) appointmentData.notes = notes;
      if (roomId) appointmentData.roomId = roomId;
      if (chiefComplaint) appointmentData.chiefComplaint = chiefComplaint;

      const result = await waitlistService.convertToAppointment(
        waitlistEntryId,
        appointmentData,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Waitlist entry converted to appointment successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteWaitlistEntry(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { waitlistEntryId } = req.params;
      
      if (!waitlistEntryId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Waitlist entry ID is required' },
        });
      }

      await waitlistService.deleteWaitlistEntry(waitlistEntryId, req.userId);

      res.status(200).json({
        success: true,
        message: 'Waitlist entry deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const waitlistController = new WaitlistController();
