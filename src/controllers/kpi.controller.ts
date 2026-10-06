import type { Request, Response, NextFunction } from 'express';
import { kpiService } from '../services/kpi.service';

/** Branches the caller may report on; undefined = unrestricted (platform admin / all-clinics profile). */
const reportableClinicIds = (req: Request): bigint[] | undefined => {
  const access = req.access;
  if (!access || access.isPlatformAdmin || access.accessAllClinics) return undefined;
  const ids = access.isGroupAdmin ? [...access.clinicIds, ...access.groupClinicIds] : access.clinicIds;
  return [...new Set(ids.map(String))].map((id) => BigInt(id));
};

export class KpiController {
  /**
   * GET /kpis
   * Returns the rolling 12-month consolidated KPI matrix.
   * Optional query params: startDate, endDate (ISO strings) for custom ranges.
   */
  async getMainKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const userId = (req as any).userId ? String((req as any).userId) : undefined;

      const metrics = await kpiService.getMainKpis(startDate, endDate, branchId, userId, reportableClinicIds(req));
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /kpis/providers
   * Returns provider-level 12-month metrics aggregated per provider.
   * Optional query params: startDate, endDate (ISO strings) for custom ranges.
   */
  async getProviderKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const userId = (req as any).userId ? String((req as any).userId) : undefined;

      const providerMetrics = await kpiService.getProviderKpis(startDate, endDate, branchId, userId, reportableClinicIds(req));
      res.status(200).json({
        success: true,
        data: providerMetrics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /kpis/summary
   * Returns the 4 top-card metrics comparing current month vs last month:
   *   - Net Production
   *   - Total Collection
   *   - Total Seen Patients
   *   - Case Accepted
   */
  async getKpiSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
      const userId = (req as any).userId ? String((req as any).userId) : undefined;

      const summary = await kpiService.getKpiSummary(branchId, userId, reportableClinicIds(req));
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const kpiController = new KpiController();
