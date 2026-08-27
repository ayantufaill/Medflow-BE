import type { Request, Response, NextFunction } from 'express';
import { publicBookingService } from '../services/public-booking.service';

export class PublicBookingController {
  async getAvailableSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.query.branchId as string;
      const providerId = req.query.providerId as string;
      const appointmentTypeId = req.query.appointmentTypeId as string;
      const date = req.query.date as string;

      const data = await publicBookingService.getPublicAvailableSlots(branchId, providerId, appointmentTypeId, date);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createGuestBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, providerId, appointmentTypeId, appointmentDate, startTime, chiefComplaint, firstName, lastName, dateOfBirth, phone, email } = req.body;

      const data = await publicBookingService.createGuestBooking({
        branchId,
        providerId,
        appointmentTypeId,
        appointmentDate,
        startTime,
        chiefComplaint,
        firstName,
        lastName,
        dateOfBirth,
        phone,
        email,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const publicBookingController = new PublicBookingController();
