import type { Request, Response, NextFunction } from 'express';
import { eraService } from '../services/era.service';

export class EraController {
  async getAllERAs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: Parameters<typeof eraService.getAllERAs>[2] = {};

      const status = req.query.status as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const search = req.query.search as string | undefined;

      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      const result = await eraService.getAllERAs(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getERAById(req: Request, res: Response, next: NextFunction) {
    try {
      const eraId = req.params.eraId as string;
      const era = await eraService.getERAById(eraId);

      res.status(200).json({
        success: true,
        data: { era },
      });
    } catch (error) {
      next(error);
    }
  }

  async getERAItems(req: Request, res: Response, next: NextFunction) {
    try {
      const eraId = req.params.eraId as string;
      const result = await eraService.getERAItems(eraId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async importERAFile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await eraService.importERAFile(
        req.body || {},
        req.file,
        req.userId
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async autoPostPayments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const eraId = req.params.eraId as string;
      const result = await eraService.autoPostPayments(eraId, req.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnmatchedItems(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: Parameters<typeof eraService.getUnmatchedItems>[2] = {};

      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const search = req.query.search as string | undefined;

      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      const result = await eraService.getUnmatchedItems(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async matchERAItem(req: Request, res: Response, next: NextFunction) {
    try {
      const eraItemId = req.params.eraItemId as string;
      const { claimId, invoiceId } = req.body || {};
      const result = await eraService.matchERAItem(eraItemId, claimId, invoiceId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const eraController = new EraController();
