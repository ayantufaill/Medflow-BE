import { Request, Response, NextFunction } from 'express';
import { productivityService } from '../services/productivity.service';
import { BadRequestError } from '../utils/error.util';

export class ProductivityController {
  
  private parseDates(req: Request) {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if not provided
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date();
    
    if (!startDate) {
      start.setDate(end.getDate() - 30);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestError('Invalid date format for startDate or endDate');
    }

    return { start, end };
  }

  getProductionOverTime = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { start, end } = this.parseDates(req);
      const data = await productivityService.getProductionOverTime(start, end);
      res.json({
        status: 'success',
        data
      });
    } catch (error) {
      next(error);
    }
  };

  getProductionByProvider = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { start, end } = this.parseDates(req);
      const data = await productivityService.getProductionByProvider(start, end);
      res.json({
        status: 'success',
        data
      });
    } catch (error) {
      next(error);
    }
  };

  getProductionByOperatory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { start, end } = this.parseDates(req);
      const data = await productivityService.getProductionByOperatory(start, end);
      res.json({
        status: 'success',
        data
      });
    } catch (error) {
      next(error);
    }
  };

  getPanelSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date, providerId } = req.query;

      let dateStr = typeof date === 'string' ? date.trim() : '';
      if (!dateStr) {
        dateStr = new Date().toISOString().split('T')[0];
      } else {
        // Validate YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          throw new BadRequestError('Invalid date format for date. Expected YYYY-MM-DD');
        }
        const [y, m, d] = dateStr.split('-').map(Number);
        const parsed = new Date(Date.UTC(y, m - 1, d));
        if (
          isNaN(parsed.getTime()) ||
          parsed.getUTCFullYear() !== y ||
          parsed.getUTCMonth() !== m - 1 ||
          parsed.getUTCDate() !== d
        ) {
          throw new BadRequestError('Invalid calendar date provided for date');
        }
      }

      const clinicNum = (req as any).user?.clinicNum ? BigInt((req as any).user.clinicNum) : undefined;
      const data = await productivityService.getPanelSummary(dateStr, typeof providerId === 'string' ? providerId : undefined, clinicNum);

      res.json({
        status: 'success',
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const productivityController = new ProductivityController();
