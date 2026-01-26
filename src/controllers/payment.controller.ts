import type { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class PaymentController {
  async getAllPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: {
        patientId?: string;
        invoiceId?: string;
        paymentMethod?: string;
        startDate?: string;
        endDate?: string;
      } = {};

      const patientId = req.query.patientId as string | undefined;
      const invoiceId = req.query.invoiceId as string | undefined;
      const paymentMethod = req.query.paymentMethod as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (patientId) filters.patientId = patientId;
      if (invoiceId) filters.invoiceId = invoiceId;
      if (paymentMethod) filters.paymentMethod = paymentMethod;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await paymentService.getAllPayments(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = req.params.paymentId as string;
      const payment = await paymentService.getPaymentById(paymentId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'payments', paymentId);
      }

      res.status(200).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  async createPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const payment = await paymentService.createPayment(
        {
          ...req.body,
          paymentDate: new Date(req.body.paymentDate),
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { payment },
        message: 'Payment recorded successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async applyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const paymentId = req.params.paymentId as string;
      const { invoiceId, amount } = req.body;
      const payment = await paymentService.applyPaymentToInvoice(
        paymentId,
        invoiceId,
        amount,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { payment },
        message: 'Payment applied successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
