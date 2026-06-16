import type { Request, Response, NextFunction } from 'express';
import { procedureCodeService } from '../services/procedure-code.service';

export class ProcedureCodeController {
  async getAllProcedureCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const codes = await procedureCodeService.getAllProcedureCodes();
      res.status(200).json({
        success: true,
        data: { procedureCodes: codes },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const procedureCodeController = new ProcedureCodeController();