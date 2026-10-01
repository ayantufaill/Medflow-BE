import type { Request, Response, NextFunction } from 'express';
import { verifyAuditChain, getAuditLogs } from '../services/audit.service';

export class SecurityController {
  async verifyAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await verifyAuditChain();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const filters = {
        userNum: req.query.userNum ?? req.query.user,
        patNum: req.query.patNum,
        permType: req.query.permType,
        startDate: req.query.startDate ?? req.query.from,
        endDate: req.query.endDate ?? req.query.to,
      };

      const result = await getAuditLogs(page, limit, filters, req.branchAccess?.clinicIds as string[] | undefined);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const securityController = new SecurityController();
