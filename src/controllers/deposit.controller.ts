import type { Request, Response, NextFunction } from 'express';
import { depositService } from '../services/deposit.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class DepositController {
  async getAllDeposits(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const filters: {
        patientId?: string;
      } = {};

      if (req.query.patientId) filters.patientId = req.query.patientId as string;

      const result = await depositService.getAllDeposits(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDepositById(req: Request, res: Response, next: NextFunction) {
    try {
      const depositId = req.params.depositId as string;
      const deposit = await depositService.getDepositById(depositId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'deposits', depositId);
      }

      res.status(200).json({
        success: true,
        data: { deposit },
      });
    } catch (error) {
      next(error);
    }
  }

  async createDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const deposit = await depositService.createDeposit(
        {
          patientId: req.body.patientId,
          amount: req.body.amount,
          paymentMethod: req.body.paymentMethod,
          depositType: req.body.depositType,
          date: req.body.date ? new Date(req.body.date) : undefined,
          notes: req.body.notes,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { deposit },
        message: 'Deposit created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getDepositsByPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const result = await depositService.getDepositsByPatient(patientId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllDepositSlips(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await depositService.getAllDepositSlips(page, limit);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnDepositedPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await depositService.getUnDepositedPayments();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createDepositSlip(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const result = await depositService.createDepositSlip(
        {
          bankAccountInfo: req.body.bankAccountInfo,
          memo: req.body.memo,
          date: req.body.date ? new Date(req.body.date) : undefined,
          patientPaymentIds: req.body.patientPaymentIds,
          insurancePaymentIds: req.body.insurancePaymentIds,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Deposit slip created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const depositController = new DepositController();

