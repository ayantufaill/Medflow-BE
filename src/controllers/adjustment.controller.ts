import type { Request, Response, NextFunction } from 'express';
import { adjustmentService } from '../services/adjustment.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class AdjustmentController {
  async getAllAdjustments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const filters: {
        patientId?: string;
        startDate?: string;
        endDate?: string;
      } = {};

      if (req.query.patientId) filters.patientId = req.query.patientId as string;
      if (req.query.startDate) filters.startDate = req.query.startDate as string;
      if (req.query.endDate) filters.endDate = req.query.endDate as string;

      const result = await adjustmentService.getAllAdjustments(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAdjustmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const adjustmentId = req.params.adjustmentId as string;
      const adjustment = await adjustmentService.getAdjustmentById(adjustmentId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'adjustments', adjustmentId);
      }

      res.status(200).json({
        success: true,
        data: { adjustment },
      });
    } catch (error) {
      next(error);
    }
  }

  async createAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const adjustment = await adjustmentService.createAdjustment(
        {
          patientId: req.body.patientId,
          amount: req.body.amount,
          date: new Date(req.body.date),
          type: req.body.type,
          providerId: req.body.providerId,
          notes: req.body.notes,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { adjustment },
        message: 'Adjustment created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const adjustmentId = req.params.adjustmentId as string;
      
      const updates: any = {};
      if (req.body.amount !== undefined) updates.amount = req.body.amount;
      if (req.body.date) updates.date = new Date(req.body.date);
      if (req.body.type) updates.type = req.body.type;
      if (req.body.providerId) updates.providerId = req.body.providerId;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;

      const adjustment = await adjustmentService.updateAdjustment(adjustmentId, updates, req.userId);

      res.status(200).json({
        success: true,
        data: { adjustment },
        message: 'Adjustment updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const adjustmentId = req.params.adjustmentId as string;
      const result = await adjustmentService.deleteAdjustment(adjustmentId, req.userId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAdjustmentsByPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const result = await adjustmentService.getAdjustmentsByPatient(patientId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adjustmentController = new AdjustmentController();
