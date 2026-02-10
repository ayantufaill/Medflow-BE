import type { Request, Response, NextFunction } from 'express';
import { estimateService } from '../services/estimate.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class EstimateController {
  async getAllEstimates(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: {
        patientId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
      } = {};

      const patientId = req.query.patientId as string | undefined;
      const status = req.query.status as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
       const search = req.query.search as string | undefined;

      if (patientId) filters.patientId = patientId;
      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      const result = await estimateService.getAllEstimates(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEstimateById(req: Request, res: Response, next: NextFunction) {
    try {
      const estimateId = req.params.estimateId as string;
      const estimate = await estimateService.getEstimateById(estimateId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'estimates', estimateId);
      }

      res.status(200).json({
        success: true,
        data: { estimate },
      });
    } catch (error) {
      next(error);
    }
  }

  async createEstimate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const payload = { ...req.body } as Parameters<typeof estimateService.createEstimate>[0];
      if (req.body.createdDate) {
        payload.createdDate = new Date(req.body.createdDate);
      } else {
        delete payload.createdDate;
      }
      if (req.body.expirationDate) {
        payload.expirationDate = new Date(req.body.expirationDate);
      } else {
        delete payload.expirationDate;
      }

      const estimate = await estimateService.createEstimate(payload, req.userId);

      res.status(201).json({
        success: true,
        data: { estimate },
        message: 'Estimate created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEstimate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const estimateId = req.params.estimateId as string;
      const updates = { ...req.body } as Parameters<typeof estimateService.updateEstimate>[1];
      if (req.body.expirationDate) {
        updates.expirationDate = new Date(req.body.expirationDate);
      } else {
        delete updates.expirationDate;
      }
      if (req.body.approvedDate) {
        updates.approvedDate = new Date(req.body.approvedDate);
      } else {
        delete updates.approvedDate;
      }

      const estimate = await estimateService.updateEstimate(estimateId, updates, req.userId);

      res.status(200).json({
        success: true,
        data: { estimate },
        message: 'Estimate updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteEstimate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const estimateId = req.params.estimateId as string;
      const result = await estimateService.deleteEstimate(estimateId, req.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async sendToPatient(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const estimateId = req.params.estimateId as string;
      const estimate = await estimateService.sendToPatient(estimateId, req.userId);

      res.status(200).json({
        success: true,
        data: { estimate },
        message: 'Estimate sent to patient successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async convertToInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const estimateId = req.params.estimateId as string;
      const { appointmentId, dueDate } = req.body;
      const invoice = await estimateService.convertToInvoice(
        estimateId,
        appointmentId,
        new Date(dueDate),
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { invoice },
        message: 'Estimate converted to invoice successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const estimateController = new EstimateController();
