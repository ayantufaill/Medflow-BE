import type { Request, Response, NextFunction } from 'express';
import { medicationService } from '../services/medication.service';

export class MedicationController {
  async getMedications(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const data = await medicationService.getAllMedications(search);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMedicationById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await medicationService.getMedicationById(id as string);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async createMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await medicationService.createMedication(req.body);
      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await medicationService.updateMedication(id as string, req.body);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const medicationController = new MedicationController();
