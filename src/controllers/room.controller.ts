import type { Request, Response, NextFunction } from 'express';
import { roomService } from '../services/room.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class RoomController {
  async getAllRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const branchId = req.query.branchId as string | undefined;

      const result = await roomService.getAllRooms(
        page,
        limit,
        search || undefined,
        isActive,
        branchId
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRoomById(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomId } = req.params;
      
      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Room ID is required' },
        });
      }

      const room = await roomService.getRoomById(roomId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'rooms', roomId);
      }

      res.status(200).json({
        success: true,
        data: { room },
      });
    } catch (error) {
      next(error);
    }
  }

  async createRoom(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { name, branchId } = req.body;

      const room = await roomService.createRoom(
        {
          name,
          branchId,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { room },
        message: 'Room created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRoom(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { roomId } = req.params;
      
      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Room ID is required' },
        });
      }
      
      const updates = req.body;

      const room = await roomService.updateRoom(
        roomId,
        updates,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { room },
        message: 'Room updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRoom(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { roomId } = req.params;
      
      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Room ID is required' },
        });
      }

      await roomService.deleteRoom(roomId, req.userId);

      res.status(200).json({
        success: true,
        message: 'Room deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const roomController = new RoomController();

