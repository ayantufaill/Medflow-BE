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
}

export const productivityController = new ProductivityController();
