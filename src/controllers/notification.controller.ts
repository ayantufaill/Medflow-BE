import type { Request, Response, NextFunction } from 'express';
import { staffNotificationService } from '../services/staffNotification.service';

export class NotificationController {
  async getMyNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, error: { message: 'User not authenticated' } });
      }
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await staffNotificationService.getForUser(req.userId, page, limit);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, error: { message: 'User not authenticated' } });
      }

      const result = await staffNotificationService.getUnreadCount(req.userId);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, error: { message: 'User not authenticated' } });
      }
      const { notificationId } = req.params;

      const notification = await staffNotificationService.markAsRead(notificationId, req.userId);

      res.status(200).json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, error: { message: 'User not authenticated' } });
      }

      const result = await staffNotificationService.markAllAsRead(req.userId);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
