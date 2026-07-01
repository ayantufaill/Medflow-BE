import type { Request, Response, NextFunction } from 'express';
import { feeManagementService } from '../services/fee-management.service';

export class FeeManagementController {
  async getFeeSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const schedules = await feeManagementService.getFeeSchedules();
      res.status(200).json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProcedureCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await feeManagementService.getProcedureCodes({
        search,
        category,
        page,
        limit,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getProcedureFees(req: Request, res: Response, next: NextFunction) {
    try {
      const procCode = req.params.procCode as string;
      const fees = await feeManagementService.getProcedureFees(procCode);
      res.status(200).json({
        success: true,
        data: fees,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProcedureFees(req: Request, res: Response, next: NextFunction) {
    try {
      const procCode = req.params.procCode as string;
      const { fees } = req.body;

      const updated = await feeManagementService.updateProcedureFees(procCode, fees);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async createFeeSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { description, feeSchedType, isGlobal } = req.body;
      const created = await feeManagementService.createFeeSchedule({
        description,
        feeSchedType: feeSchedType !== undefined ? parseInt(feeSchedType, 10) : 0,
        isGlobal: isGlobal !== undefined ? Boolean(isGlobal) : true,
      });
      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateFeeSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { description, feeSchedType, isHidden, isGlobal } = req.body;
      const updated = await feeManagementService.updateFeeSchedule(id as string, {
        description,
        feeSchedType: feeSchedType !== undefined ? parseInt(feeSchedType, 10) : undefined,
        isHidden: isHidden !== undefined ? Boolean(isHidden) : undefined,
        isGlobal: isGlobal !== undefined ? Boolean(isGlobal) : undefined,
      });
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteFeeSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await feeManagementService.deleteFeeSchedule(id as string);
      res.status(200).json({
        success: true,
        message: 'Fee schedule deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async copyFeeSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { description } = req.body;
      const copied = await feeManagementService.copyFeeSchedule(id as string, description as string);
      res.status(201).json({
        success: true,
        data: copied,
      });
    } catch (error) {
      next(error);
    }
  }

  async reestimateTPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeManagementService.reestimateTPlans();
      res.status(200).json({
        success: true,
        message: 'Treatment plan fee re-estimation started successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async clearLockedFees(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feeManagementService.clearLockedFees();
      res.status(200).json({
        success: true,
        message: 'Locked fees cleared successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async resetTPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientIds } = req.body;
      const result = await feeManagementService.resetTPlans(patientIds);
      res.status(200).json({
        success: true,
        message: 'Treatment plans reset to default successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getFeeScheduleById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const sched = await feeManagementService.getFeeScheduleById(id as string);
      res.status(200).json({
        success: true,
        data: sched,
      });
    } catch (error) {
      next(error);
    }
  }

  async getFeeScheduleFees(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await feeManagementService.getFeeScheduleFees(id as string, {
        search,
        category,
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateFeeScheduleFees(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { fees } = req.body;

      const result = await feeManagementService.updateFeeScheduleFees(id as string, fees);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async roundFeeScheduleFees(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { toNearest } = req.body;

      const result = await feeManagementService.roundFeeScheduleFees(
        id as string,
        toNearest !== undefined ? parseFloat(toNearest) : 1
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async setProviderFeeSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { providerId } = req.body;

      const result = await feeManagementService.setProviderFeeSchedule(id as string, providerId as string);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadFeeScheduleFees(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { fees } = req.body;

      const result = await feeManagementService.updateFeeScheduleFees(id as string, fees);
      res.status(200).json({
        success: true,
        message: 'Fees uploaded successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const feeManagementController = new FeeManagementController();
