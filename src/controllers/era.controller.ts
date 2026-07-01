import type { Request, Response, NextFunction } from 'express';
import { eraService } from '../services/era.service';

export class EraController {
  async importERAFile(req: Request, res: Response, next: NextFunction) {
    try {
      const uploadedFile =
        req.file ?? (Array.isArray(req.files) ? (req.files[0] as Express.Multer.File | undefined) : undefined);

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          error: { message: 'No file uploaded' },
        });
      }

      const result = await eraService.importERAFile(uploadedFile, req.userId);

      res.status(201).json({
        success: true,
        data: result,
        message: 'ERA file imported successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllERAs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await eraService.getAllERAs(page, limit, {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });

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
      const items = await eraService.getERAItems(eraId);

      res.status(200).json({
        success: true,
        data: { items },
      });
    } catch (error) {
      next(error);
    }
  }

  async autoPostPayments(req: Request, res: Response, next: NextFunction) {
    try {
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

      const result = await eraService.getUnmatchedItems(page, limit, {
        search: req.query.search as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });

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
      const result = await eraService.matchERAItem(
        eraItemId,
        req.body.claimId,
        req.body.invoiceId
      );

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
