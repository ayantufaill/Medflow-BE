import type { Request, Response, NextFunction } from 'express';
import { timeClockService } from '../services/timeclock.service';

export class TimeClockController {
  /**
   * Get timesheets aggregated per employee within date range
   */
  async getTimesheets(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const dateRange = req.query.dateRange as string | undefined;

      const result = await timeClockService.getTimesheets(startDate, endDate, dateRange);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add a new Time Clock record
   */
  async addTimeClockRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, employeeNum, date, time, recordType, note } = req.body;

      if (!date || !time || !recordType) {
        return res.status(400).json({
          success: false,
          error: { message: 'Date, time, and recordType are required fields.' },
        });
      }

      const result = await timeClockService.addTimeClockRecord({
        userId: user,
        employeeNum,
        date,
        time,
        recordType,
        note,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const timeClockController = new TimeClockController();
