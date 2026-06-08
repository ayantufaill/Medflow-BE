import type { Request, Response, NextFunction } from 'express';
import { kpiService } from '../services/kpi.service';

export class KpiController {
  async getMainKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = await kpiService.getMainKpis();
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProviderKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const providerMetrics = await kpiService.getProviderKpis();
      res.status(200).json({
        success: true,
        data: providerMetrics,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const kpiController = new KpiController();
