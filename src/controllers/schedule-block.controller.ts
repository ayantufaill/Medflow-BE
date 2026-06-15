import type { Request, Response, NextFunction } from 'express';
import { scheduleBlockService } from '../services/schedule-block.service';

export class ScheduleBlockController {
  async getBlocksForDate(req: Request, res: Response, next: NextFunction) {
    try {
      const date = req.query.date as string;
      if (!date) {
        return res.status(400).json({
          success: false,
          error: { message: 'Date query parameter (YYYY-MM-DD) is required' },
        });
      }

      const blocks = await scheduleBlockService.getBlocksForDate(date);

      res.status(200).json({
        success: true,
        data: blocks,
      });
    } catch (error) {
      next(error);
    }
  }

  async createBlock(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { roomId, date, startTime, endTime, notes, color } = req.body;

      if (!roomId || !date || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          error: { message: 'roomId, date, startTime, and endTime are required' },
        });
      }

      const block = await scheduleBlockService.createBlock(
        {
          roomId,
          date,
          startTime,
          endTime,
          notes: notes || '',
          color: color || '#7e57c2',
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: block,
        message: 'Schedule block created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteBlock(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { blockId } = req.params;

      if (!blockId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Block ID parameter is required' },
        });
      }

      await scheduleBlockService.deleteBlock(blockId, req.userId);

      res.status(200).json({
        success: true,
        message: 'Schedule block deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const scheduleBlockController = new ScheduleBlockController();
