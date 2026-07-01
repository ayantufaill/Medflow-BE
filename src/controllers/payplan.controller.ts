import type { Request, Response, NextFunction } from 'express';
import { payPlanService } from '../services/payplan.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class PayPlanController {
  async getAllPayPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const filters: {
        patientId?: string;
      } = {};

      if (req.query.patientId) filters.patientId = req.query.patientId as string;

      const result = await payPlanService.getAllPayPlans(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPayPlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const payPlanId = req.params.payPlanId as string;
      const payPlan = await payPlanService.getPayPlanById(payPlanId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'payplans', payPlanId);
      }

      res.status(200).json({
        success: true,
        data: { payPlan },
      });
    } catch (error) {
      next(error);
    }
  }

  async createPayPlan(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const payPlan = await payPlanService.createPayPlan(
        {
          patientId: req.body.patientId,
          totalAmount: req.body.totalAmount,
          downPayment: req.body.downPayment,
          monthlyPayment: req.body.monthlyPayment,
          numberOfPayments: req.body.numberOfPayments,
          apr: req.body.apr,
          startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
          notes: req.body.notes,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { payPlan },
        message: 'Payment plan created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePayPlan(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const payPlanId = req.params.payPlanId as string;
      
      const updates: any = {};
      if (req.body.isClosed !== undefined) updates.isClosed = req.body.isClosed;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;

      const payPlan = await payPlanService.updatePayPlan(payPlanId, updates, req.userId);

      res.status(200).json({
        success: true,
        data: { payPlan },
        message: 'Payment plan updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getPayPlansByPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const result = await payPlanService.getPayPlansByPatient(patientId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const payPlanController = new PayPlanController();
