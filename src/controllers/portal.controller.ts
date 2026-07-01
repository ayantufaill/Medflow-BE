import type { NextFunction, Request, Response } from 'express';
import { AuthenticationError } from '../utils/error.util';
import { portalService } from '../services/portal.service';

const requireUserId = (req: Request) => {
  if (!req.userId) {
    throw new AuthenticationError('User not authenticated');
  }
  return req.userId;
};

export class PortalController {
  async getMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const profile = await portalService.getMyProfile(userId);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const profile = await portalService.updateMyProfile(userId, req.body);
      res.status(200).json({
        success: true,
        data: profile,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const page = parseInt(String(req.query.page || '1'), 10) || 1;
      const limit = parseInt(String(req.query.limit || '10'), 10) || 10;
      const result = await portalService.getMyAppointments(userId, page, limit, {
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getMyAppointmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const appointmentId = req.params.appointmentId as string;
      const appointment = await portalService.getMyAppointmentById(userId, appointmentId);
      res.status(200).json({ success: true, data: { appointment } });
    } catch (error) {
      next(error);
    }
  }

  async getProviders(req: Request, res: Response, next: NextFunction) {
    try {
      await requireUserId(req);
      const providers = await portalService.getProviders();
      res.status(200).json({ success: true, data: { providers } });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const providerId = req.query.providerId as string;
      const date = req.query.date as string;
      const durationMinutes = parseInt(String(req.query.durationMinutes || '30'), 10) || 30;
      const slots = await portalService.getAvailableSlots(userId, providerId, date, durationMinutes);
      res.status(200).json({ success: true, data: slots });
    } catch (error) {
      next(error);
    }
  }

  async bookAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const appointment = await portalService.bookAppointment(userId, req.body);
      res.status(201).json({
        success: true,
        data: { appointment },
        message: 'Appointment booked successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async rescheduleAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const appointmentId = req.params.appointmentId as string;
      const appointment = await portalService.rescheduleAppointment(userId, appointmentId, {
        newDate: req.body.newDate,
        newStartTime: req.body.newStartTime,
        newEndTime: req.body.newEndTime,
      });
      res.status(200).json({
        success: true,
        data: { appointment },
        message: 'Appointment rescheduled successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const appointmentId = req.params.appointmentId as string;
      const appointment = await portalService.cancelAppointment(
        userId,
        appointmentId,
        req.body.cancellationReason
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

  async getMessageThreads(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const result = await portalService.getMessageThreads(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getThreadMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const threadId = req.params.threadId as string;
      const result = await portalService.getThreadMessages(userId, threadId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const messages = await portalService.sendMessage(userId, req.body);
      res.status(201).json({
        success: true,
        data: {
          messages,
          message: messages[0] ?? null,
        },
        message: 'Message sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyForms(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const page = parseInt(String(req.query.page || '1'), 10) || 1;
      const limit = parseInt(String(req.query.limit || '10'), 10) || 10;
      const result = await portalService.getMyForms(userId, page, limit);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getPendingForms(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const result = await portalService.getPendingForms(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async submitForm(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const form = await portalService.submitForm(userId, req.body);
      res.status(201).json({
        success: true,
        data: { form },
        message: 'Form submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyFormById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const formId = req.params.formId as string;
      const form = await portalService.getMyFormById(userId, formId);
      res.status(200).json({ success: true, data: { form } });
    } catch (error) {
      next(error);
    }
  }

  async updateMyForm(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const formId = req.params.formId as string;
      const form = await portalService.updateMyForm(userId, formId, req.body);
      res.status(200).json({
        success: true,
        data: { form },
        message: 'Form updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getProviderMessageThreads(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const result = await portalService.getProviderMessageThreads(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getProviderThreadMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const threadId = req.params.threadId as string;
      const result = await portalService.getProviderThreadMessages(userId, threadId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async replyToProviderThread(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const message = await portalService.replyToProviderThread(userId, req.body);
      res.status(201).json({
        success: true,
        data: { message },
        message: 'Reply sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getProviderPatientContext(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const patientId = req.params.patientId as string;
      const result = await portalService.getProviderPatientContext(userId, patientId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const page = parseInt(String(req.query.page || '1'), 10) || 1;
      const limit = parseInt(String(req.query.limit || '20'), 10) || 20;
      const result = await portalService.getNotifications(userId, page, limit);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const notificationId = req.params.notificationId as string;
      const result = await portalService.markNotificationRead(userId, notificationId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getNotificationPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const result = await portalService.getNotificationPreferences(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = requireUserId(req);
      const result = await portalService.updateNotificationPreferences(userId, req.body);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Notification preferences updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const portalController = new PortalController();
