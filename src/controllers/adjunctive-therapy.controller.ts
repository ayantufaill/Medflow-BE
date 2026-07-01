import type { Request, Response, NextFunction } from 'express';
import { adjunctiveTherapyService } from '../services/adjunctive-therapy.service';

export class AdjunctiveTherapyController {
  async getPatientAdjunctiveTherapy(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const data = await adjunctiveTherapyService.getPatientAdjunctiveTherapy(patientId as string);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async savePatientAdjunctiveTherapy(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const data = await adjunctiveTherapyService.savePatientAdjunctiveTherapy(patientId as string, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const adjunctiveTherapyController = new AdjunctiveTherapyController();
