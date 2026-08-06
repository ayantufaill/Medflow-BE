import type { Request, Response, NextFunction } from 'express';
import { dashboardMetricsService } from '../services/dashboard-metrics.service';

export class DashboardMetricsController {
  async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const date = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0];
      const range = req.query.range ? String(req.query.range) : 'Daily';
      const providerId = req.query.providerId ? String(req.query.providerId) : 'All';
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const data = await dashboardMetricsService.getDashboardMetrics(date, range, providerId, startDate, endDate);
      
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGoals(req: Request, res: Response, next: NextFunction) {
    try {
      const goals = await dashboardMetricsService.getDashboardGoals();
      res.status(200).json({
        success: true,
        data: goals,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateGoals(req: Request, res: Response, next: NextFunction) {
    try {
      const goals = await dashboardMetricsService.saveDashboardGoals(req.body);
      res.status(200).json({
        success: true,
        data: goals,
        message: 'Dashboard goals updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardMetricsController = new DashboardMetricsController();
