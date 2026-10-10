import type { Request, Response, NextFunction } from 'express';
import { adjustmentService } from '../services/adjustment.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';
import { assertNotLocked } from '../utils/lock-date.util';

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

      const adjDate = req.body.date ? new Date(req.body.date) : new Date();
      await assertNotLocked(req.userId, 'adjustments.create', adjDate, req.branchAccess!);

      const adjustment = await adjustmentService.createAdjustment(
        {
          patientId: req.body.patientId,
          amount: req.body.amount,
          date: new Date(req.body.date),
          type: req.body.type,
          providerId: req.body.providerId,
          notes: req.body.notes,
          invoiceId: req.body.invoiceId,
          procedureId: req.body.procedureId,
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
      
      const existing = await adjustmentService.getAdjustmentById(adjustmentId);
      const existingDate = existing.date ? new Date(existing.date as unknown as string) : new Date();
      await assertNotLocked(req.userId, 'adjustments.update', existingDate, req.branchAccess!);

      const updates: any = {};
      if (req.body.amount !== undefined) updates.amount = req.body.amount;
      if (req.body.date) {
         const newDate = new Date(req.body.date);
         await assertNotLocked(req.userId, 'adjustments.update', newDate, req.branchAccess!);
         updates.date = newDate;
      }
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
      const existing = await adjustmentService.getAdjustmentById(adjustmentId);
      const existingDate = existing.date ? new Date(existing.date as unknown as string) : new Date();
      await assertNotLocked(req.userId, 'adjustments.delete', existingDate, req.branchAccess!);

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
